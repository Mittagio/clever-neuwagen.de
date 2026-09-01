/**
 * Apply confirmed Multi-Source Intake – nur nach Seller-Confirm („Alles übernehmen“).
 * Arbeitet ausschließlich auf validiertem / review-bestätigtem Intake (kein OpenAI-Direktpersist).
 *
 * Ablauf: Confirm → Apply Plan → Result Report → Audit Activity
 */
import { searchCustomers } from '../../crm/customerSearchService.js';
import {
  findDuplicateCustomerContract,
  persistConfirmedCustomerContract,
} from '../../crm/customerContracts.js';
import {
  buildVehicleKey,
  ensureVehicleTrack,
  listCustomerVehicleTracks,
  patchVehicleTrackOnLead,
  VEHICLE_TRACK_STATUS,
} from '../../crm/vehicleTrack.js';
import {
  COMMERCIAL_CUSTOMER_TYPE,
  COMMERCIAL_SCENARIO_SOURCE,
  normalizeCommercialScenario,
  setCommercialScenariosOnLead,
} from '../../crm/commercialScenarios.js';
import {
  createVehicleOfferForScenario,
  mergeVehicleOfferById,
} from '../../vehicleOffer.js';
import { getTradeIn, patchTradeIn } from '../../customerAkteTradeIn.js';
import {
  createEmptyNeedProfile,
  getNeedProfileFromLead,
  mergeNeedProfileIntoLead,
} from '../../consultation/needProfileService.js';
import { appendSellerInsightsFromTexts } from '../../dealer/sellerInsights.js';
import { buildInboundLeadDraft } from '../inboundLeadIntake.js';
import { SENSITIVE_FIELD_BLOCKLIST } from './mergeMultiSourceIntakePlan.js';

const OP = {
  RESOLVE_CUSTOMER: 'resolve_customer',
  CREATE_OR_LINK_CUSTOMER: 'create_or_link_customer',
  APPLY_VEHICLE_INTEREST: 'apply_vehicle_interest',
  APPLY_TRACK_PREFERENCES: 'apply_track_preferences',
  APPLY_COMMERCIAL_SCENARIO: 'apply_commercial_scenario',
  APPLY_CURRENT_HOUSEHOLD: 'apply_current_household_facts',
  APPLY_TRADE_IN: 'apply_trade_in',
  IMPORT_HISTORICAL_CONTRACT: 'import_historical_contract',
  LINK_SOURCE_DOCUMENT: 'link_source_document',
  PREPARE_OFFER_ORDER: 'prepare_offer_order',
  WRITE_AUDIT_ACTIVITY: 'write_audit_activity',
};

const ORDERED_OPS = [
  OP.RESOLVE_CUSTOMER,
  OP.CREATE_OR_LINK_CUSTOMER,
  OP.APPLY_VEHICLE_INTEREST,
  OP.APPLY_TRACK_PREFERENCES,
  OP.APPLY_COMMERCIAL_SCENARIO,
  OP.APPLY_CURRENT_HOUSEHOLD,
  OP.APPLY_TRADE_IN,
  OP.IMPORT_HISTORICAL_CONTRACT,
  OP.LINK_SOURCE_DOCUMENT,
  OP.PREPARE_OFFER_ORDER,
  OP.WRITE_AUDIT_ACTIVITY,
];

/**
 * Stable idempotency key from confirmed intake sources (no PII dump).
 * @param {object} intake
 */
export function buildMultiSourceIdempotencyKey(intake = {}) {
  const name = normalizeNameKey(intake.resolvedCustomerCandidate?.fullName || '');
  const att = (intake.sources?.attachmentIds || []).map(String).sort().join('|');
  const end = intake.historicalContract?.contractEndDate
    || intake.contractDraft?.contractEndDate
    || intake.contractDraft?.fields?.contractEndDate
    || '';
  const trade = normalizeNameKey(intake.tradeInCandidate?.label || '');
  const wish = normalizeNameKey([
    intake.currentVehicleInterest?.model,
    intake.currentVehicleInterest?.trim,
  ].filter(Boolean).join('-'));
  return `ms-apply:${name}:${att || 'no-att'}:${end || 'no-end'}:${trade || 'no-trade'}:${wish || 'no-wish'}`;
}

/**
 * @param {object} [lead]
 * @param {object} turn – CleverSellerTurnResult with multiSourceIntake
 * @param {{
 *   sellerId?: string,
 *   sellerName?: string,
 *   allowCreateCustomer?: boolean,
 *   leadsSnapshot?: object[],
 *   selectedLeadId?: string|null,
 *   now?: Date,
 *   force?: boolean,
 * }} [options]
 */
export function applyConfirmedMultiSourceIntakePlan(lead = {}, turn = {}, options = {}) {
  const intake = turn?.multiSourceIntake
    || turn?.reviewModel?.multiSourceIntake
    || null;

  if (!intake?.detected) {
    return emptyFailure('no_multi_source_intake');
  }

  const now = options.now || new Date();
  const nowIso = now.toISOString();
  const operationId = options.operationId
    || `ms-op-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const idempotencyKey = options.idempotencyKey || buildMultiSourceIdempotencyKey(intake);

  const ops = ORDERED_OPS.map((id) => ({
    id,
    status: 'pending',
    detail: null,
  }));
  const createdIds = {};
  const skippedDuplicates = [];
  const warnings = [];
  const errors = [];
  let nextLead = lead?.id ? { ...lead } : {};

  // --- Idempotency: prior successful apply with same key ---
  if (!options.force && lead?.id) {
    const prior = getLedgerEntry(lead, idempotencyKey);
    if (prior?.status === 'completed' || prior?.status === 'partial') {
      return {
        ok: true,
        status: 'idempotent_replay',
        partialFailure: prior.status === 'partial',
        operationId: prior.operationId || operationId,
        idempotencyKey,
        orderedOperations: (prior.orderedOperations || ORDERED_OPS).map((id) => ({
          id,
          status: 'skipped_duplicate',
          detail: 'idempotent_replay',
        })),
        createdIds: prior.createdIds || {},
        skippedDuplicates: [
          ...(prior.skippedDuplicates || []),
          { kind: 'apply_run', key: idempotencyKey },
        ],
        warnings: ['Bereits übernommen – keine Dublette erzeugt.'],
        errors: [],
        lead,
        intake,
        rollbackCapability: 'none',
        acceptedLabels: ['Bereits übernommen (Idempotenz)'],
        needsSellerChoice: null,
        summary: buildSummaryLabels(prior.createdIds || {}, true),
      };
    }
  }

  // 1) Resolve customer
  const resolve = resolveCustomerForApply({
    lead,
    intake,
    leadsSnapshot: options.leadsSnapshot || [],
    selectedLeadId: options.selectedLeadId || null,
  });
  setOp(ops, OP.RESOLVE_CUSTOMER, resolve.status, resolve.detail);

  if (resolve.needsSellerChoice) {
    return {
      ok: false,
      status: 'needs_seller_choice',
      partialFailure: false,
      operationId,
      idempotencyKey,
      orderedOperations: ops,
      createdIds,
      skippedDuplicates,
      warnings: resolve.warnings || [],
      errors: [],
      lead: lead?.id ? lead : {},
      intake,
      rollbackCapability: 'none',
      acceptedLabels: [],
      needsSellerChoice: resolve.needsSellerChoice,
      summary: { applied: [], prepared: [], open: ['Kundenauswahl erforderlich'] },
    };
  }

  // 2) Create or link
  if (resolve.existingLead?.id) {
    nextLead = { ...resolve.existingLead };
    setOp(ops, OP.CREATE_OR_LINK_CUSTOMER, 'applied', `linked:${nextLead.id}`);
    createdIds.leadId = nextLead.id;
    createdIds.customerLinked = true;
  } else if (options.allowCreateCustomer !== false) {
    const candidate = intake.resolvedCustomerCandidate || {};
    nextLead = buildInboundLeadDraft({
      fullName: candidate.fullName,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: sanitizeContactValue(candidate.email),
      phone: sanitizeContactValue(candidate.phone),
      subject: 'Multi-Source Intake (bestätigt)',
    }, { dealerId: options.dealerId });
    nextLead = {
      ...nextLead,
      source: 'composer_multi_source',
      notes: 'Multi-Source Intake über Composer bestätigt',
      history: [{
        id: `h-ms-${now.getTime()}`,
        at: nowIso,
        type: 'system',
        text: 'Kundenakte aus Multi-Source-Intake vorgeschlagen und bestätigt',
      }],
    };
    // Kein System-Default preferredContact=email (sonst Soft „lieber E-Mail“)
    if (candidate.phone) {
      nextLead = {
        ...nextLead,
        contact: { ...(nextLead.contact || {}), preferredContact: 'phone' },
      };
    } else if (nextLead.contact && 'preferredContact' in nextLead.contact) {
      const { preferredContact: _omit, ...contactRest } = nextLead.contact;
      nextLead = { ...nextLead, contact: contactRest };
    }
    createdIds.leadId = nextLead.id;
    createdIds.customerCreated = true;
    setOp(ops, OP.CREATE_OR_LINK_CUSTOMER, 'applied', `created:${nextLead.id}`);
  } else {
    setOp(ops, OP.CREATE_OR_LINK_CUSTOMER, 'failed', 'create_not_allowed');
    errors.push('Keine Kundenakte – Anlegen nicht erlaubt.');
    return finalize({
      ok: false,
      status: 'failed',
      partialFailure: true,
      operationId,
      idempotencyKey,
      ops,
      createdIds,
      skippedDuplicates,
      warnings,
      errors,
      lead: nextLead,
      intake,
      nowIso,
      acceptedLabels: [],
    });
  }

  // 3) Vehicle interest + track
  let trackId = null;
  try {
    const wish = intake.currentVehicleInterest;
    if (wish?.model) {
      const modelKey = guessModelKey(wish);
      const vehicleKey = buildVehicleKey({
        brand: 'kia',
        model: wish.model,
        modelKey,
      });
      const ensured = ensureVehicleTrack(nextLead, {
        vehicleKey,
        displayName: [wish.make || 'Kia', wish.model, wish.trim].filter(Boolean).join(' '),
        model: wish.model,
        modelKey,
        trimLabel: wish.trim || '',
      });
      nextLead = ensured.lead;
      trackId = ensured.trackId;
      if (ensured.created) {
        createdIds.vehicleTrackId = trackId;
      } else {
        skippedDuplicates.push({ kind: 'vehicle_track', id: trackId });
      }
      nextLead = {
        ...nextLead,
        vehicle: {
          ...(nextLead.vehicle || {}),
          brand: wish.make || 'Kia',
          model: wish.model,
          trim: wish.trim || nextLead.vehicle?.trim || '',
          label: wish.label
            || [wish.make || 'Kia', wish.model, wish.trim].filter(Boolean).join(' '),
        },
      };
      let profile = { ...(getNeedProfileFromLead(nextLead) || createEmptyNeedProfile()) };
      profile.selectedModelKey = modelKey;
      profile.modelHint = modelKey;
      if (modelKey.startsWith('ev')) {
        profile.fuel = 'electric';
      }
      if (wish.trim) {
        profile.equipmentWishes = pushUnique(profile.equipmentWishes || [], wish.trim);
      }
      for (const eq of wish.requestedEquipment || []) {
        if (eq) profile.equipmentWishes = pushUnique(profile.equipmentWishes || [], eq);
      }
      if (wish.color) {
        profile.colorPreference = String(wish.color).toLowerCase();
      }
      nextLead = mergeNeedProfileIntoLead(nextLead, profile);
      setOp(ops, OP.APPLY_VEHICLE_INTEREST, 'applied', trackId);
    } else {
      setOp(ops, OP.APPLY_VEHICLE_INTEREST, 'skipped', 'no_vehicle_interest');
    }
  } catch (err) {
    setOp(ops, OP.APPLY_VEHICLE_INTEREST, 'failed', String(err?.message || err));
    errors.push(`Fahrzeuginteresse: ${err?.message || err}`);
  }

  // 4) Color + AHK on track
  try {
    const wish = intake.currentVehicleInterest;
    if (trackId && wish) {
      const reqs = [];
      if (wish.color) reqs.push(`Farbe: ${wish.color}`);
      for (const eq of wish.requestedEquipment || []) {
        if (eq) reqs.push(eq);
      }
      nextLead = patchVehicleTrackOnLead(nextLead, trackId, {
        status: VEHICLE_TRACK_STATUS.ACTIVE,
        customerRequirements: reqs,
        lastActivityAt: nowIso,
      });
      let profile = { ...(getNeedProfileFromLead(nextLead) || createEmptyNeedProfile()) };
      let touched = false;
      if (wish.color) {
        profile.colorPreference = String(wish.color).toLowerCase();
        touched = true;
      }
      for (const eq of wish.requestedEquipment || []) {
        if (!eq) continue;
        profile.equipmentWishes = pushUnique(profile.equipmentWishes || [], eq);
        touched = true;
      }
      if ((wish.requestedEquipment || []).some((e) => /ahk/i.test(e))) {
        profile.towbar = true;
        profile.priorities = pushUnique(profile.priorities || [], 'towing');
        touched = true;
      }
      if (String(guessModelKey(wish) || '').startsWith('ev')) {
        profile.fuel = 'electric';
        touched = true;
      }
      if (touched) nextLead = mergeNeedProfileIntoLead(nextLead, profile);
      setOp(ops, OP.APPLY_TRACK_PREFERENCES, 'applied', reqs.join(' · ') || 'track');
    } else {
      setOp(ops, OP.APPLY_TRACK_PREFERENCES, 'skipped', 'no_track');
    }
  } catch (err) {
    setOp(ops, OP.APPLY_TRACK_PREFERENCES, 'failed', String(err?.message || err));
    errors.push(`Spur-Präferenzen: ${err?.message || err}`);
  }

  // 5) Commercial scenario
  try {
    const commercial = intake.commercialScenario;
    if (commercial && (commercial.termMonths != null || commercial.annualMileage != null)) {
      const scenario = normalizeCommercialScenario({
        id: `ms-${commercial.type || 'leasing'}-1`,
        type: commercial.type || 'leasing',
        termMonths: commercial.termMonths,
        annualMileage: commercial.annualMileage,
        vehicleTrackId: trackId,
        customerType: COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
        source: COMMERCIAL_SCENARIO_SOURCE.SELLER,
        label: commercial.label,
      });
      if (scenario) {
        const existing = Array.isArray(nextLead.wish?.commercialScenarios)
          ? nextLead.wish.commercialScenarios
          : [];
        const dupScenario = existing.find((s) => (
          s.type === scenario.type
          && Number(s.termMonths) === Number(scenario.termMonths)
          && Number(s.annualMileage ?? s.mileagePerYear) === Number(scenario.annualMileage)
        ));
        if (dupScenario) {
          skippedDuplicates.push({ kind: 'commercial_scenario', id: dupScenario.id });
          setOp(ops, OP.APPLY_COMMERCIAL_SCENARIO, 'skipped_duplicate', dupScenario.id);
        } else {
          nextLead = setCommercialScenariosOnLead(nextLead, [
            ...existing.filter((s) => s.id !== scenario.id),
            scenario,
          ]);
          nextLead = {
            ...nextLead,
            wish: {
              ...(nextLead.wish || {}),
              termMonths: commercial.termMonths ?? nextLead.wish?.termMonths,
              mileagePerYear: commercial.annualMileage ?? nextLead.wish?.mileagePerYear,
              paymentType: scenario.type || nextLead.wish?.paymentType,
              commercialScenarios: [
                ...(nextLead.wish?.commercialScenarios || []).filter((s) => s.id !== scenario.id),
                scenario,
              ],
            },
            paymentType: scenario.type || nextLead.paymentType,
          };
          createdIds.commercialScenarioId = scenario.id;
          setOp(ops, OP.APPLY_COMMERCIAL_SCENARIO, 'applied', scenario.id);
        }
      } else {
        setOp(ops, OP.APPLY_COMMERCIAL_SCENARIO, 'skipped', 'invalid_scenario');
      }
    } else {
      setOp(ops, OP.APPLY_COMMERCIAL_SCENARIO, 'skipped', 'no_commercial');
    }
  } catch (err) {
    setOp(ops, OP.APPLY_COMMERCIAL_SCENARIO, 'failed', String(err?.message || err));
    errors.push(`Konditionen: ${err?.message || err}`);
  }

  // 6) Current household (NOT historical contract child count)
  try {
    const hh = intake.currentHouseholdFacts;
    if (hh && (hh.childrenCount != null || hh.housingType)) {
      let profile = { ...(getNeedProfileFromLead(nextLead) || createEmptyNeedProfile()) };
      profile.household = {
        ...(profile.household || {}),
        ...(hh.childrenCount != null ? { childrenCount: Number(hh.childrenCount) } : {}),
        ...(hh.housingType ? { housingType: hh.housingType } : {}),
      };
      // Never write historical child count into current truth
      nextLead = mergeNeedProfileIntoLead(nextLead, profile);
      createdIds.householdApplied = true;
      setOp(ops, OP.APPLY_CURRENT_HOUSEHOLD, 'applied', hh.label || 'household');
    } else {
      setOp(ops, OP.APPLY_CURRENT_HOUSEHOLD, 'skipped', 'no_household');
    }
  } catch (err) {
    setOp(ops, OP.APPLY_CURRENT_HOUSEHOLD, 'failed', String(err?.message || err));
    errors.push(`Haushalt: ${err?.message || err}`);
  }

  // 7) Trade-in / existing vehicle
  try {
    const trade = intake.tradeInCandidate;
    if (trade?.label || trade?.model) {
      const current = getTradeIn(nextLead);
      const label = trade.label
        || [trade.make, trade.model].filter(Boolean).join(' ');
      const isDup = current.vehicle
        && normalizeNameKey(current.vehicle) === normalizeNameKey(label);
      if (isDup) {
        skippedDuplicates.push({
          kind: 'trade_in',
          vehicle: current.vehicle,
          reason: 'same_vehicle',
        });
        setOp(ops, OP.APPLY_TRADE_IN, 'skipped_duplicate', current.vehicle);
      } else if (current.vehicle && current.vehicle.trim()
        && normalizeNameKey(current.vehicle) !== normalizeNameKey(label)) {
        // Possible conflict – do not auto-overwrite different trade-in
        warnings.push(`Inzahlungnahme bereits gesetzt (${current.vehicle}) – nicht überschrieben.`);
        skippedDuplicates.push({
          kind: 'trade_in',
          vehicle: current.vehicle,
          candidate: label,
          reason: 'existing_different',
        });
        setOp(ops, OP.APPLY_TRADE_IN, 'needs_seller_choice', label);
      } else {
        nextLead = {
          ...nextLead,
          crm: {
            ...(nextLead.crm || {}),
            tradeIn: patchTradeIn(current, {
              vehicle: label,
              notes: [current.notes, 'Inzahlungnahme (Multi-Source bestätigt)', trade.role || 'trade_in_vehicle']
                .filter(Boolean)
                .join(' · '),
              sourceContractRef: intake.historicalContract?.contractEndDate
                || intake.sources?.attachmentIds?.[0]
                || null,
            }),
            existingVehicle: {
              make: trade.make || 'Kia',
              model: trade.model || label,
              label,
              role: 'existing_vehicle',
              tradeInCandidate: true,
              source: 'multi_source_intake',
              updatedAt: nowIso,
            },
          },
        };
        createdIds.tradeInVehicle = label;
        setOp(ops, OP.APPLY_TRADE_IN, 'applied', label);
      }
    } else {
      setOp(ops, OP.APPLY_TRADE_IN, 'skipped', 'no_trade_in');
    }
  } catch (err) {
    setOp(ops, OP.APPLY_TRADE_IN, 'failed', String(err?.message || err));
    errors.push(`Inzahlungnahme: ${err?.message || err}`);
  }

  // 8) Historical contract (structured; sensitive fields stripped)
  let contractRecord = null;
  try {
    const draft = buildPersistableContractDraft(intake);
    if (draft && nextLead?.id) {
      const dup = findDuplicateCustomerContract(nextLead, draft);
      if (dup) {
        contractRecord = dup;
        skippedDuplicates.push({ kind: 'contract', id: dup.id });
        setOp(ops, OP.IMPORT_HISTORICAL_CONTRACT, 'skipped_duplicate', dup.id);
      } else {
        const persisted = persistConfirmedCustomerContract(nextLead, draft, {
          now,
          activityText: 'Altvertrag aus Multi-Source übernommen',
        });
        nextLead = persisted.lead || nextLead;
        contractRecord = persisted.contract;
        if (persisted.duplicate) {
          skippedDuplicates.push({ kind: 'contract', id: persisted.contract?.id });
          setOp(ops, OP.IMPORT_HISTORICAL_CONTRACT, 'skipped_duplicate', persisted.contract?.id);
        } else if (persisted.ok && persisted.contract) {
          createdIds.contractId = persisted.contract.id;
          // Preserve historical household only on contract evidence (not customer truth)
          if (intake.historicalHousehold?.childrenCount != null) {
            nextLead = attachHistoricalHouseholdEvidence(
              nextLead,
              persisted.contract.id,
              intake.historicalHousehold,
              nowIso,
            );
          }
          setOp(ops, OP.IMPORT_HISTORICAL_CONTRACT, 'applied', persisted.contract.id);
        } else {
          setOp(ops, OP.IMPORT_HISTORICAL_CONTRACT, 'failed', 'persist_failed');
          errors.push('Altvertrag konnte nicht gespeichert werden.');
        }
      }
    } else {
      setOp(ops, OP.IMPORT_HISTORICAL_CONTRACT, 'skipped', draft ? 'no_lead' : 'no_contract');
    }
  } catch (err) {
    setOp(ops, OP.IMPORT_HISTORICAL_CONTRACT, 'failed', String(err?.message || err));
    errors.push(`Altvertrag: ${err?.message || err}`);
  }

  // 9) Link original document (protected ref – no full extract into truth)
  try {
    const link = buildSourceDocumentLink(intake, contractRecord);
    if (link) {
      const existingLinks = Array.isArray(nextLead.crm?.linkedSourceDocuments)
        ? nextLead.crm.linkedSourceDocuments
        : [];
      const dupLink = existingLinks.find((d) => (
        (link.sourceId && d.sourceId === link.sourceId)
        || (link.fileName && d.fileName === link.fileName && d.kind === link.kind)
      ));
      if (dupLink) {
        skippedDuplicates.push({ kind: 'source_document', id: dupLink.id || dupLink.sourceId });
        setOp(ops, OP.LINK_SOURCE_DOCUMENT, 'skipped_duplicate', dupLink.sourceId || dupLink.fileName);
      } else {
        const docId = `srcdoc-${now.getTime().toString(36)}`;
        nextLead = {
          ...nextLead,
          crm: {
            ...(nextLead.crm || {}),
            linkedSourceDocuments: [
              { id: docId, ...link, linkedAt: nowIso, protected: true },
              ...existingLinks,
            ],
          },
        };
        createdIds.sourceDocumentId = docId;
        setOp(ops, OP.LINK_SOURCE_DOCUMENT, 'applied', docId);
      }
    } else {
      setOp(ops, OP.LINK_SOURCE_DOCUMENT, 'skipped', 'no_document');
    }
  } catch (err) {
    setOp(ops, OP.LINK_SOURCE_DOCUMENT, 'failed', String(err?.message || err));
    errors.push(`Dokument: ${err?.message || err}`);
  }

  // 10) Prepare open offer order (shell, no auto-send)
  try {
    const wish = intake.currentVehicleInterest;
    const commercial = intake.commercialScenario;
    if (trackId && wish?.model) {
      const scenarioId = createdIds.commercialScenarioId
        || `ms-${commercial?.type || 'leasing'}-1`;
      const offerId = `vo-${trackId}-${scenarioId}`;
      const existingOffer = nextLead.crm?.vehicleOffers?.[offerId];
      if (existingOffer) {
        skippedDuplicates.push({ kind: 'offer_shell', id: offerId });
        setOp(ops, OP.PREPARE_OFFER_ORDER, 'skipped_duplicate', offerId);
        createdIds.offerShellId = offerId;
      } else {
        const shell = createVehicleOfferForScenario({
          trackId,
          scenarioId,
          offerId,
          patch: {
            termMonths: commercial?.termMonths ?? null,
            mileagePerYear: commercial?.annualMileage ?? null,
            downPayment: 0,
            status: 'draft',
            preparedFrom: 'multi_source_intake',
          },
        });
        nextLead = mergeVehicleOfferById(nextLead, offerId, shell);
        createdIds.offerShellId = offerId;
        nextLead = {
          ...nextLead,
          crm: {
            ...(nextLead.crm || {}),
            openOfferOrders: [
              {
                id: `oor-${offerId}`,
                offerId,
                trackId,
                model: wish.model,
                trim: wish.trim || null,
                status: 'prepared',
                label: `Angebotsauftrag ${[wish.make || 'Kia', wish.model, wish.trim].filter(Boolean).join(' ')}`,
                createdAt: nowIso,
                source: 'multi_source_intake',
              },
              ...(Array.isArray(nextLead.crm?.openOfferOrders) ? nextLead.crm.openOfferOrders : []),
            ],
          },
        };
        setOp(ops, OP.PREPARE_OFFER_ORDER, 'applied', offerId);
      }
    } else {
      setOp(ops, OP.PREPARE_OFFER_ORDER, 'skipped', 'no_track_or_wish');
    }
  } catch (err) {
    setOp(ops, OP.PREPARE_OFFER_ORDER, 'failed', String(err?.message || err));
    errors.push(`Angebotsauftrag: ${err?.message || err}`);
  }

  // 11) Audit activity + seller insights (no sensitive fields)
  // Soft/sellerInsights: nur echte Kundenfacts – nie Prozess-Status („Kunde angelegt“, …).
  // Confirm/Activity/Summary behalten Status über activity + buildSummaryLabels.
  try {
    const factLabels = buildCustomerFactInsightLabels(intake, createdIds);
    for (const label of factLabels) {
      nextLead = appendSellerInsightsFromTexts(nextLead, [label], {
        context: 'multi_source_apply',
        sellerId: options.sellerId,
        sellerName: options.sellerName,
        // Exaktes Soft-Label behalten (kein mergeText→„Picanto interessant“ / Modell-Chips)
        understoodLabels: [label],
      });
    }
    const activityText = [
      'Multi-Source Intake übernommen',
      intake.resolvedCustomerCandidate?.fullName,
      intake.currentVehicleInterest?.label || intake.currentVehicleInterest?.model,
      intake.tradeInCandidate?.label ? `GW ${intake.tradeInCandidate.label}` : null,
      intake.historicalContract ? 'Altvertrag' : null,
    ].filter(Boolean).join(' · ');
    const activities = Array.isArray(nextLead.crm?.activities) ? nextLead.crm.activities : [];
    const actId = `act-ms-${operationId}`;
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead.crm || {}),
        activities: [
          {
            id: actId,
            type: 'multi_source_intake_applied',
            label: activityText,
            operationId,
            idempotencyKey,
            createdAt: nowIso,
            visibleToCustomer: false,
          },
          ...activities,
        ],
      },
      updatedAt: nowIso,
    };
    createdIds.activityId = actId;
    setOp(ops, OP.WRITE_AUDIT_ACTIVITY, 'applied', actId);

    // Strip any sensitive keys that may have leaked into contact/truth
    nextLead = scrubSensitiveFromLead(nextLead);
  } catch (err) {
    setOp(ops, OP.WRITE_AUDIT_ACTIVITY, 'failed', String(err?.message || err));
    errors.push(`Activity: ${err?.message || err}`);
  }

  const failedOps = ops.filter((o) => o.status === 'failed');
  const appliedOps = ops.filter((o) => o.status === 'applied');
  const partialFailure = failedOps.length > 0 && appliedOps.length > 0;
  const ok = appliedOps.length > 0 && (failedOps.length === 0 || partialFailure);
  const status = failedOps.length && !appliedOps.length
    ? 'failed'
    : (partialFailure ? 'partial' : 'completed');

  return finalize({
    ok: Boolean(ok && nextLead?.id),
    status,
    partialFailure,
    operationId,
    idempotencyKey,
    ops,
    createdIds,
    skippedDuplicates,
    warnings,
    errors,
    lead: nextLead,
    intake,
    nowIso,
    acceptedLabels: buildCustomerFactInsightLabels(intake, createdIds),
    contract: contractRecord,
  });
}

function finalize(params) {
  const {
    ok,
    status,
    partialFailure,
    operationId,
    idempotencyKey,
    ops,
    createdIds,
    skippedDuplicates,
    warnings,
    errors,
    lead,
    intake,
    nowIso,
    acceptedLabels,
    contract = null,
  } = params;

  let nextLead = lead;
  if (nextLead?.id && (status === 'completed' || status === 'partial')) {
    nextLead = writeLedger(nextLead, idempotencyKey, {
      operationId,
      status,
      createdIds,
      skippedDuplicates,
      orderedOperations: ops.map((o) => o.id),
      appliedAt: nowIso,
    });
  }

  return {
    ok,
    status,
    partialFailure: Boolean(partialFailure),
    operationId,
    idempotencyKey,
    orderedOperations: ops,
    createdIds,
    skippedDuplicates,
    warnings,
    errors,
    lead: nextLead,
    intake,
    contract,
    rollbackCapability: 'none',
    acceptedLabels,
    needsSellerChoice: null,
    created: Boolean(createdIds.customerCreated),
    summary: buildSummaryLabels(createdIds, status === 'idempotent_replay'),
  };
}

function emptyFailure(reason) {
  return {
    ok: false,
    status: 'failed',
    partialFailure: false,
    operationId: null,
    idempotencyKey: null,
    orderedOperations: [],
    createdIds: {},
    skippedDuplicates: [],
    warnings: [],
    errors: [reason],
    lead: {},
    intake: null,
    rollbackCapability: 'none',
    acceptedLabels: [],
    needsSellerChoice: null,
    summary: { applied: [], prepared: [], open: [] },
  };
}

function resolveCustomerForApply({
  lead,
  intake,
  leadsSnapshot,
  selectedLeadId,
}) {
  if (selectedLeadId) {
    const picked = (leadsSnapshot || []).find((l) => l.id === selectedLeadId);
    if (picked?.id) {
      return {
        status: 'applied',
        detail: `selected:${picked.id}`,
        existingLead: picked,
        needsSellerChoice: null,
      };
    }
  }

  if (lead?.id) {
    return {
      status: 'applied',
      detail: `context:${lead.id}`,
      existingLead: lead,
      needsSellerChoice: null,
    };
  }

  const candidate = intake.resolvedCustomerCandidate || {};
  const query = [
    candidate.fullName,
    candidate.email,
    candidate.phone,
  ].filter(Boolean).join(' ').trim();

  // Document-ref match: prior linked source or contract sourceId
  const sourceId = (intake.sources?.attachmentIds || [])[0] || null;
  const docHits = sourceId
    ? (leadsSnapshot || []).filter((l) => (
      (l.crm?.linkedSourceDocuments || []).some((d) => d.sourceId === sourceId)
      || (l.crm?.customerContracts || []).some((c) => c.sourceDocument?.sourceId === sourceId)
    ))
    : [];

  if (docHits.length === 1) {
    return {
      status: 'applied',
      detail: `document_ref:${docHits[0].id}`,
      existingLead: docHits[0],
      needsSellerChoice: null,
    };
  }
  if (docHits.length > 1) {
    return {
      status: 'needs_seller_choice',
      detail: 'ambiguous_document_ref',
      existingLead: null,
      needsSellerChoice: {
        kind: 'customer_duplicate',
        reason: 'Mehrere Kunden mit derselben Dokumentreferenz',
        candidates: docHits.slice(0, 6).map((l) => ({
          leadId: l.id,
          customerName: l.contact?.name || l.name,
        })),
      },
      warnings: ['Mögliche Kundendublette über Dokument – bitte auswählen.'],
    };
  }

  if (!query) {
    return {
      status: 'applied',
      detail: 'no_query_create',
      existingLead: null,
      needsSellerChoice: null,
    };
  }

  const hits = searchCustomers(query, leadsSnapshot || [], { limit: 6 }) || [];

  if (hits.length === 1) {
    const id = hits[0].leadId || hits[0].id;
    const existing = (leadsSnapshot || []).find((l) => l.id === id) || null;
    if (existing) {
      return {
        status: 'applied',
        detail: `unique:${existing.id}`,
        existingLead: existing,
        needsSellerChoice: null,
      };
    }
  }

  if (hits.length > 1) {
    return {
      status: 'needs_seller_choice',
      detail: 'ambiguous_name',
      existingLead: null,
      needsSellerChoice: {
        kind: 'customer_duplicate',
        reason: 'Mehrere passende Kunden gefunden',
        candidates: hits.slice(0, 6).map((h) => ({
          leadId: h.leadId || h.id,
          customerName: h.customerName || h.name,
          matchReasons: h.matchReasons || [],
        })),
      },
      warnings: ['Mögliche Kundendublette – bitte Akte wählen.'],
    };
  }

  return {
    status: 'applied',
    detail: 'no_match_create',
    existingLead: null,
    needsSellerChoice: null,
  };
}

/**
 * Flatten intake contract shapes (deterministic enriched draft OR OpenAI fields bag).
 */
export function buildPersistableContractDraft(intake = {}) {
  const raw = intake.contractDraft;
  const hist = intake.historicalContract;
  if (!raw && !hist) return null;

  const fields = raw?.fields && typeof raw.fields === 'object' ? raw.fields : {};
  const vehicleFromRaw = raw?.vehicle && typeof raw.vehicle === 'object' ? raw.vehicle : null;
  const vehicleLabel = vehicleFromRaw?.label
    || hist?.vehicle
    || [fields.vehicleMake || vehicleFromRaw?.make, fields.vehicleModel || vehicleFromRaw?.model]
      .filter(Boolean)
      .join(' ');

  const draft = {
    contractType: raw?.contractType || fields.contractType || hist?.contractType || null,
    contractNumber: raw?.contractNumber || fields.contractNumber || null,
    vehicle: vehicleFromRaw || (vehicleLabel ? {
      make: fields.vehicleMake || (hist?.vehicle || '').split(/\s+/)[0] || 'Kia',
      model: fields.vehicleModel
        || (hist?.vehicle || '').replace(/^\S+\s*/, '').trim()
        || vehicleLabel,
      label: vehicleLabel,
    } : null),
    monthlyRate: numOrNull(raw?.monthlyRate ?? fields.monthlyRate ?? hist?.monthlyRate),
    finalPayment: numOrNull(raw?.finalPayment ?? fields.finalPayment ?? hist?.finalPayment),
    downPayment: numOrNull(raw?.downPayment ?? fields.downPayment),
    termMonths: numOrNull(raw?.termMonths ?? fields.termMonths ?? hist?.termMonths),
    contractStartDate: raw?.contractStartDate || fields.contractStartDate || hist?.contractStartDate || null,
    contractEndDate: raw?.contractEndDate || fields.contractEndDate || hist?.contractEndDate || null,
    annualMileage: numOrNull(
      raw?.annualMileage ?? fields.annualMileage ?? hist?.annualMileage ?? hist?.totalMileage,
    ),
    excessMileageRate: numOrNull(raw?.excessMileageRate ?? fields.excessMileageRate ?? hist?.excessMileageRate),
    underMileageRate: numOrNull(raw?.underMileageRate ?? fields.underMileageRate ?? hist?.underMileageRate),
    bankOrLeasingCompany: raw?.bankOrLeasingCompany || fields.bankOrLeasingCompany || null,
    sourceDocument: sanitizeSourceDocument(
      raw?.sourceDocument || {
        sourceType: raw?.sourceType || 'contract_pdf',
        sourceId: (intake.sources?.attachmentIds || [])[0] || null,
        fileName: null,
        preview: null,
      },
    ),
    evidence: sanitizeEvidence([
      ...(Array.isArray(raw?.evidence) ? raw.evidence : []),
      ...(Array.isArray(hist?.evidence) ? hist.evidence : []),
      ...(intake.historicalHousehold?.childrenCount != null
        ? [{
          field: 'childrenCount',
          value: intake.historicalHousehold.childrenCount,
          temporalScope: 'historical',
          sourceType: intake.historicalHousehold.source || 'contract_pdf',
          label: `Historisch: ${intake.historicalHousehold.childrenCount} Kind(er)`,
        }]
        : []),
    ]),
    relation: 'original_contract',
    mutatesCustomerTruth: false,
  };

  // Drop sensitive keys if any slipped through
  for (const key of SENSITIVE_FIELD_BLOCKLIST) {
    delete draft[key];
    if (draft.sourceDocument) delete draft.sourceDocument[key];
  }

  if (!draft.vehicle && !draft.contractEndDate && draft.monthlyRate == null) {
    return null;
  }
  return draft;
}

function buildSourceDocumentLink(intake, contractRecord) {
  const attId = (intake.sources?.attachmentIds || [])[0] || null;
  const fromContract = contractRecord?.sourceDocument || intake.contractDraft?.sourceDocument || null;
  if (!attId && !fromContract?.sourceId && !fromContract?.fileName && !intake.sources?.contractPdf) {
    return null;
  }
  return sanitizeSourceDocument({
    kind: 'contract_pdf',
    sourceType: fromContract?.sourceType || 'contract_pdf',
    sourceId: fromContract?.sourceId || attId,
    fileName: fromContract?.fileName || (typeof attId === 'string' && attId.includes('.') ? attId : null),
    contractId: contractRecord?.id || null,
    preview: null,
  });
}

function sanitizeSourceDocument(doc = {}) {
  if (!doc || typeof doc !== 'object') return null;
  return {
    sourceType: doc.sourceType || 'contract_pdf',
    sourceId: doc.sourceId || null,
    fileName: doc.fileName || null,
    kind: doc.kind || null,
    contractId: doc.contractId || null,
    // never persist long extracts / IBAN previews into general truth
    preview: null,
  };
}

function sanitizeEvidence(list = []) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && !SENSITIVE_FIELD_BLOCKLIST.has(e.field))
    .map((e) => ({
      field: e.field || null,
      value: e.value,
      label: e.label || null,
      temporalScope: e.temporalScope || null,
      sourceType: e.sourceType || null,
      confidence: e.confidence ?? null,
    }))
    .slice(0, 24);
}

function attachHistoricalHouseholdEvidence(lead, contractId, historicalHousehold, nowIso) {
  const list = Array.isArray(lead?.crm?.customerContracts) ? lead.crm.customerContracts : [];
  return {
    ...lead,
    crm: {
      ...(lead.crm || {}),
      customerContracts: list.map((c) => {
        if (c.id !== contractId) return c;
        const evidence = Array.isArray(c.evidence) ? c.evidence : [];
        if (evidence.some((e) => e.field === 'childrenCount' && e.temporalScope === 'historical')) {
          return c;
        }
        return {
          ...c,
          evidence: [
            ...evidence,
            {
              field: 'childrenCount',
              value: historicalHousehold.childrenCount,
              temporalScope: 'historical',
              sourceType: historicalHousehold.source || 'contract_pdf',
              label: `Historisch: ${historicalHousehold.childrenCount} Kind(er)`,
              recordedAt: nowIso,
            },
          ],
          updatedAt: nowIso,
        };
      }),
    },
  };
}

function scrubSensitiveFromLead(lead = {}) {
  const next = { ...lead };
  const contact = { ...(next.contact || {}) };
  for (const key of SENSITIVE_FIELD_BLOCKLIST) {
    delete contact[key];
  }
  // Never promote full address / IBAN into contact from apply
  delete contact.iban;
  delete contact.street;
  delete contact.address;
  delete contact.idNumber;

  const truth = { ...(next.crm?.customerTruth || {}) };
  for (const key of SENSITIVE_FIELD_BLOCKLIST) {
    delete truth[key];
  }
  delete truth.iban;
  delete truth.income;
  delete truth.employer;
  delete truth.monthlyNetIncome;

  return {
    ...next,
    contact,
    crm: {
      ...(next.crm || {}),
      customerTruth: truth,
    },
  };
}

function buildCustomerFactInsightLabels(intake = {}, createdIds = {}) {
  const labels = [];
  const seen = new Set();
  const push = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    labels.push(text);
  };

  const hh = intake.currentHouseholdFacts;
  if (hh?.childrenCount != null && Number.isFinite(Number(hh.childrenCount))) {
    const n = Number(hh.childrenCount);
    push(n === 1 ? '1 Kind' : `${n} Kinder`);
  }
  if (hh?.housingType === 'own_house') {
    push('Haus');
  } else if (hh?.housingType === 'apartment' || hh?.housingType === 'wohnung') {
    push('Wohnung');
  } else if (hh?.label) {
    // Fallback: Label-Teile (ohne Prozess-Wörter)
    for (const part of String(hh.label).split(/\s*[·|,;]\s*/)) {
      const p = part.trim();
      if (!p) continue;
      if (/kunde|angelegt|vorbereitet|vertrag|intake|akte/i.test(p)) continue;
      push(p);
    }
  }

  const wish = intake.currentVehicleInterest;
  if (wish?.color) {
    const color = String(wish.color).trim();
    push(color.charAt(0).toUpperCase() + color.slice(1));
  }
  for (const eq of wish?.requestedEquipment || []) {
    if (eq) push(String(eq).trim());
  }
  // Antrieb nur wenn explizit am Interest – EV-Modell setzt fuel im Apply separat
  if (wish?.drive || wish?.fuel || wish?.powertrain) {
    const drive = String(wish.drive || wish.fuel || wish.powertrain).trim();
    if (drive) {
      push(drive.charAt(0).toUpperCase() + drive.slice(1));
    }
  } else if (wish?.model && /\bev\s*\d/i.test(String(wish.model))) {
    push('Elektro');
  }

  if (createdIds.tradeInVehicle) {
    push(`Altes Auto: ${createdIds.tradeInVehicle}`);
  }

  const contactPref = resolveExplicitContactPreferenceLabel(intake);
  if (contactPref) push(contactPref);

  return labels;
}

/** Nur echte Kunden-Kontaktpräferenz aus Intake-Facts – kein System-Default. */
function resolveExplicitContactPreferenceLabel(intake = {}) {
  const facts = [
    ...(intake.semanticPlan?.currentCustomerFacts || []),
    ...(Array.isArray(intake.currentCustomerFacts) ? intake.currentCustomerFacts : []),
  ];
  for (const fact of facts) {
    const field = String(fact?.field || '').toLowerCase();
    const value = String(fact?.value ?? fact?.evidence ?? '').toLowerCase();
    const evidence = String(fact?.evidence || '').toLowerCase();
    const blob = `${field} ${value} ${evidence}`;
    if (!/contact|kontakt|channel|kommunikation|email|e-?mail|whatsapp|telefon|phone/i.test(blob)) {
      continue;
    }
    if (/whatsapp/i.test(blob)) return 'bevorzugt WhatsApp';
    if (/e-?mail|mail/i.test(blob) && /lieber|bevorzug|prefer|wunsch/i.test(blob)) {
      return 'lieber E-Mail';
    }
    if (/telefon|phone|anruf/i.test(blob) && /lieber|bevorzug|prefer|wunsch/i.test(blob)) {
      return 'lieber telefonisch';
    }
  }
  return null;
}

function buildSummaryLabels(createdIds = {}, replay = false) {
  const applied = [];
  const prepared = [];
  const open = [];
  if (replay) {
    return {
      applied: ['Bereits vorhandene Übernahme (Idempotenz)'],
      prepared: [],
      open: [],
    };
  }
  if (createdIds.customerCreated) applied.push('Neue Kundenakte');
  if (createdIds.customerLinked) applied.push('Bestehende Kundenakte ergänzt');
  if (createdIds.vehicleTrackId || createdIds.commercialScenarioId) {
    applied.push('Fahrzeuginteresse & Konditionen');
  }
  if (createdIds.householdApplied) applied.push('Aktuelle Angaben (Haushalt)');
  if (createdIds.tradeInVehicle) applied.push(`Inzahlungnahme ${createdIds.tradeInVehicle}`);
  if (createdIds.contractId) applied.push('Historischer Vertrag');
  if (createdIds.sourceDocumentId) applied.push('Originaldokument verknüpft');
  if (createdIds.offerShellId) prepared.push('Offener Angebotsauftrag EV4');
  if (!createdIds.customerCreated && !createdIds.customerLinked) {
    open.push('Kundenkontakt (E-Mail/Telefon)');
  }
  return { applied, prepared, open };
}

function getLedgerEntry(lead, key) {
  const ledger = lead?.crm?.multiSourceApplyLedger;
  if (!ledger || typeof ledger !== 'object') return null;
  return ledger[key] || null;
}

function writeLedger(lead, key, entry) {
  return {
    ...lead,
    crm: {
      ...(lead.crm || {}),
      multiSourceApplyLedger: {
        ...(lead.crm?.multiSourceApplyLedger || {}),
        [key]: entry,
      },
    },
  };
}

function setOp(ops, id, status, detail) {
  const row = ops.find((o) => o.id === id);
  if (row) {
    row.status = status;
    row.detail = detail || null;
  }
}

function guessModelKey(wish = {}) {
  const raw = String(wish.model || wish.label || '').toLowerCase();
  const ev = raw.match(/ev\s*(\d)/i);
  if (ev) return `ev${ev[1]}`;
  return slugify(wish.model || 'fahrzeug');
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'fahrzeug';
}

function normalizeNameKey(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function sanitizeContactValue(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Refuse IBAN-shaped / Ausweis-shaped strings as contact
  if (/\b[A-Z]{2}\d{2}\s?\d/i.test(s) && s.replace(/\s/g, '').length >= 15) return null;
  if (/ausweis|iban|gehalt/i.test(s)) return null;
  return s.slice(0, 120);
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pushUnique(list, item) {
  if (!item) return list;
  if (list.includes(item)) return list;
  return [...list, item];
}

export { OP as MULTI_SOURCE_APPLY_OPS, ORDERED_OPS as MULTI_SOURCE_APPLY_ORDER };

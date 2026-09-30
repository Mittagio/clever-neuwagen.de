/**
 * node --test src/services/crm/presentCleverStageHero.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractColorLabel,
  extractDownPaymentLabel,
  presentActivityTrigger,
  presentCleverStageHero,
  presentLocalOpenPoints,
  presentPackageLabels,
} from './presentCleverStageHero.js';

describe('presentCleverStageHero', () => {
  it('packt Pakete und lässt PDF-Farbe nicht als Farbe prüfen stehen', () => {
    const hero = presentCleverStageHero({
      snapshot: {
        title: 'EV3 Earth',
        colorLabel: 'Schneeweiß Uni',
        termLabel: '48 M',
        mileageLabel: '15.000 km',
        downPaymentLabel: '5.000 €',
        rateValue: '335,86 €',
        rateUnit: '/Monat',
      },
      workBriefing: {
        sections: {
          customerWants: 'EV3 · Earth · Schneeweiß',
          leasingWish: '48 Monate · 15.000 km/Jahr · 5.000 € Sonderzahlung · max. 335,86 €/Monat',
          important: 'Winter Connect Paket · Drive Wise · ev-std · upgrade-paket · winter-connect-paket · business-paket · drivewise-park-paket · Winter Connect Paket prüfen · Drive Wise prüfen',
          toClarify: 'Farbe prüfen',
        },
      },
      activities: [
        { headline: 'Angebot erstellt', whenLabel: 'Heute 11:17' },
        { headline: 'Kundenakte angelegt', whenLabel: 'Heute 11:15' },
      ],
    });

    assert.equal(hero.offerMode, true);
    assert.equal(hero.title, 'EV3 Earth');
    assert.equal(hero.colorLabel, 'Schneeweiß Uni');
    assert.equal(hero.termLabel, '48 M');
    assert.equal(hero.mileageLabel, '15.000 km/Jahr');
    assert.equal(hero.downPaymentLabel, '5.000 €');
    assert.equal(hero.rate.value, '335,86 €');
    assert.deepEqual(hero.openPoints, []);
    assert.ok(hero.packages.includes('Winter Connect Paket'));
    assert.ok(hero.packages.includes('Upgrade-Paket'));
    assert.ok(hero.packages.includes('Business-Paket'));
    assert.ok(!hero.packages.some((p) => /ev-std/i.test(p)));
    assert.equal(hero.packages.length, 5);
    assert.ok(!hero.packages.some((p) => /prüfen/i.test(p)));
    assert.equal(hero.activityTrigger, 'Letzte Aktivität · Heute 11:17');
    assert.equal(hero.activities.length, 2);
    assert.equal(hero.customerContext.hasData, false);
  });

  it('zeigt max. 4 verkaufsrelevante Kundenbild-Infos, Soft Facts nur im Popover', () => {
    const hero = presentCleverStageHero({
      snapshot: {
        title: 'EV3 Earth',
        colorLabel: 'Schneeweiß Uni',
        termLabel: '48 M',
        mileageLabel: '15.000 km',
        downPaymentLabel: '5.000 €',
        rateValue: '335,86 €',
        rateUnit: '/Monat',
        packageLabels: ['Winter Connect Paket'],
      },
      workBriefing: {
        sections: {
          important: 'Winter Connect Paket · AHK · Wärmepumpe',
          planned: 'Fahrzeug sofort benötigt',
          customerPicture: '2 Kinder · Hund',
        },
      },
      customerSnapshot: {
        soft: {
          chips: [
            { label: 'AHK · wichtig', groupId: 'ausstattungTechnik', editKey: 'equipment' },
            { label: 'Wärmepumpe · wichtig', groupId: 'ausstattungTechnik', editKey: 'equipment' },
            { label: '2 Kinder', groupId: 'persoenliches', editKey: 'children' },
            { label: 'Hund', groupId: 'persoenliches', editKey: 'dog' },
            { label: 'verheiratet', groupId: 'persoenliches', editKey: 'bedarf' },
            { label: 'Kaffee schwarz', groupId: 'sonstiges', editKey: 'bedarf' },
            { label: 'Fahrzeug sofort benötigt', groupId: 'persoenliches', editKey: 'delivery' },
            { label: 'Wunschrate ca. 350 €', groupId: 'persoenliches', editKey: 'desiredRate' },
            { label: '48 Monate', groupId: 'persoenliches', editKey: 'termMonths' },
            { label: '335,86 € / Monat', groupId: 'persoenliches', editKey: 'desiredRate' },
          ],
        },
      },
    });

    assert.deepEqual(hero.customerContext.visible, ['AHK', 'Wärmepumpe', '2 Kinder', 'Hund']);
    assert.equal(hero.customerContext.overflow, 4);
    assert.match(hero.customerContext.trigger, /\+4/);
    assert.ok(hero.customerContext.groups.bedarf.some((l) => /AHK/i.test(l)));
    assert.ok(hero.customerContext.groups.rahmen.some((l) => /sofort|350/i.test(l)));
    assert.ok(hero.customerContext.groups.persoenlich.some((l) => /Kaffee/i.test(l)));
    assert.ok(hero.customerContext.groups.persoenlich.some((l) => /verheiratet/i.test(l)));
    assert.ok(!hero.customerContext.visible.includes('Kaffee schwarz'));
    assert.ok(!hero.customerContext.trigger.includes('48'));
    assert.ok(!hero.customerContext.trigger.includes('335'));
    assert.ok(!hero.customerContext.groups.bedarf.some((l) => /Winter Connect/i.test(l)));
  });

  it('hält echte offene Punkte lokal, wenn keine Farbe im Hero steht', () => {
    const points = presentLocalOpenPoints('Variante prüfen · Paket prüfen', { colorShown: false });
    assert.equal(points.length, 2);
    assert.equal(points[0].compact, 'Variante · prüfen');
  });

  it('liest Farbe und AZ aus Briefing, wenn Snapshot sie nicht trägt', () => {
    assert.equal(extractColorLabel('EV3 · Earth · Schneeweiß', null), 'Schneeweiß');
    assert.equal(
      extractDownPaymentLabel('48 Monate · 5.000 € Sonderzahlung', null),
      '5.000 €',
    );
    assert.deepEqual(
      presentPackageLabels('Wärmepumpe · AHK'),
      ['Wärmepumpe', 'AHK'],
    );
    assert.equal(presentActivityTrigger([]), null);
  });
});

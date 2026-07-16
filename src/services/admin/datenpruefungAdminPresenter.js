/**
 * KPIs für Oberadmin „Datenprüfung“ (Shell).
 */
import { countOpenLearningRequests } from './cleverLearningRequestService.js';
import {
  KNOWLEDGE_ANSWER_STATUS,
  listCleverKnowledgeAnswers,
} from './cleverKnowledgeAnswerService.js';
import { countOpenCustomerQuestions } from './openCustomerQuestionsService.js';

/**
 * @param {{ pendingImports?: number, technicalMismatch?: number | null, technicalPendingProfiles?: number | null }} [extras]
 */
export function buildDatenpruefungKpis(extras = {}) {
  const pendingKnowledge = listCleverKnowledgeAnswers({
    status: KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW,
  }).length;

  return {
    pendingImports: extras.pendingImports ?? 0,
    technicalMismatch: extras.technicalMismatch,
    technicalPendingProfiles: extras.technicalPendingProfiles,
    openLearningRequests: countOpenLearningRequests(),
    pendingKnowledgeAnswers: pendingKnowledge,
    openCustomerQuestions: countOpenCustomerQuestions(),
  };
}

export const DATENPRUEFUNG_TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'preislisten', label: 'Preislisten' },
  { id: 'technisch', label: 'Technische Daten' },
  { id: 'ausstattung', label: 'Ausstattung' },
  { id: 'lernen', label: 'Clever Lernen' },
  { id: 'qualitaet', label: 'Clever Qualität' },
  { id: 'kundenfragen', label: 'Kundenfragen' },
];

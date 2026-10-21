const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export async function fetchWithAuth(url, options = {}) {
  const customKey = localStorage.getItem('callerlog_gemini_key') || '';
  const headers = {
    'Content-Type': 'application/json',
    ...(customKey ? { 'X-Gemini-Key': customKey } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Transcripts & Stages
  getStages: () => fetchWithAuth('/transcripts/stages'),
  getTranscripts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/transcripts${query ? `?${query}` : ''}`);
  },
  getTranscript: (id) => fetchWithAuth(`/transcripts/${id}`),
  parseCustomTranscript: (payload) =>
    fetchWithAuth('/transcripts/parse-custom', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // AI & Analysis
  analyzeCall: (payload) =>
    fetchWithAuth('/analysis/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  generateWhatsAppTemplate: (payload) =>
    fetchWithAuth('/analysis/whatsapp-template', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getBattlecard: (objection) =>
    fetchWithAuth(`/analysis/battlecard${objection ? `?objection=${encodeURIComponent(objection)}` : ''}`),
  reviseAnalysis: (payload) =>
    fetchWithAuth('/analysis/revise', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Calls Ledger
  getCalls: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/calls${query ? `?${query}` : ''}`);
  },
  getTargetActiveCall: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`/calls/target-active${query ? `?${query}` : ''}`);
  },
  getCallDetail: (id) => fetchWithAuth(`/calls/${id}`),
  deleteCall: (id) =>
    fetchWithAuth(`/calls/${id}`, {
      method: 'DELETE',
    }),
  saveReviewedCall: (payload) =>
    fetchWithAuth('/calls/save-reviewed', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Companies & Dossiers
  getCompanies: () => fetchWithAuth('/companies'),
  getCompanyDossier: (id) => fetchWithAuth(`/companies/${id}/dossier`),

  // Analytics
  getAnalyticsOverview: (source = 'all') =>
    fetchWithAuth(`/analytics/overview?source=${source}`),
};

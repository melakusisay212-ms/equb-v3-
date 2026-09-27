const STORAGE_KEY = 'equb_admin_v2';

/**
 * Simple storage that works in browser (localStorage)
 * and can later be swapped to Capacitor Preferences.
 */
export async function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Load failed', e);
  }
  return {
    equbs: {},
    settings: {
      theme: 'default',
      lang: 'en',
      lateFee: 50,
      smsTemplate: 'Selam [Name], please pay your Equb contribution of [Amount] Birr for cycle [Cycle]. Thank you.'
    }
  };
}

export async function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Save failed', e);
  }
}

(function(){
  const apiBase = location.origin;
  const el = (id) => document.getElementById(id);
  el('apiBase').textContent = apiBase;
  el('createdBy').value = (window.navigator.userAgent.includes('Mac')) ? '@mac' : '@user';

  async function checkHealth() {
    try {
      const r = await fetch(apiBase + '/v1/health');
      if (r.ok) {
        el('health').textContent = 'ready';
        el('health').className = 'badge ok';
      } else throw new Error(String(r.status));
    } catch (e) {
      el('health').textContent = 'offline';
      el('health').className = 'badge err';
    }
  }
  checkHealth();

  function parseAttachments(text) {
    return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(p => ({ kind: 'attachment', path: p }));
  }

  function buildBundle() {
    const title = el('title').value.trim() || 'Untitled';
    const created_by = el('createdBy').value.trim() || '@user';
    const md = el('markdown').value.trim();
    const atts = parseAttachments(el('attachments').value);

    const parts = [];
    if (md) parts.push({ kind: 'markdown', content: md });
    parts.push(...atts);

    return {
      title,
      created_by,
      source_sessions: [],
      parts,
      tags: [],
      redactions: [],
    };
  }

  el('publish').addEventListener('click', async () => {
    const bundle = buildBundle();
    const ingest = el('ingest').checked;

    el('publish').disabled = true;
    el('out').textContent = 'Publishing…';
    try {
      const r = await fetch(apiBase + '/v1/vos_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'opencode_pm', op: 'specbundle.create', payload: { bundle, ingest } })
      });
      const j = await r.json();
      el('out').textContent = JSON.stringify(j, null, 2);
    } catch (e) {
      el('out').textContent = 'ERROR: ' + (e && e.message ? e.message : String(e));
    } finally {
      el('publish').disabled = false;
    }
  });
})();

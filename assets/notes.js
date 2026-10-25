// Community notes: LinkedIn sign-in (Supabase), contributor application, moderated notes.
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KINDS = { 'local-update': 'Local update', practice: 'Practice on the ground', research: 'Research pointer', correction: 'Correction', question: 'Open question' };
  const cfg = window.AIETHOS_SB;
  let sb = null;
  function client() {
    if (sb) return sb;
    if (!window.supabase) return null;
    sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, detectSessionInUrl: true } });
    return sb;
  }
  window.AIETHOS_NOTES = { esc, client, KINDS };
  async function listApproved(j) {
    const c = client(); if (!c) return null;
    const { data, error } = await c.from('notes').select('*').eq('jurisdiction', j).eq('status', 'approved').order('created_at', { ascending: false });
    return error ? null : data;
  }
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
  const noteHTML = n => `<article class="cp-card"><div class="cp-note">${esc(KINDS[n.kind] || n.kind)} · ${esc(n.created_at.slice(0, 10))}</div><p>${esc(n.body)}</p>${n.source_url && safeUrl(n.source_url) ? `<p class="cp-note">Source: <a href="${esc(safeUrl(n.source_url))}" rel="noopener nofollow ugc" target="_blank">${esc(n.source_url)}</a></p>` : ''}<p class="cp-note"><b>${esc(n.author_name)}</b>, ${esc(n.author_expertise)}${n.author_linkedin ? ` · <a href="${esc(n.author_linkedin)}" rel="noopener nofollow" target="_blank">LinkedIn profile</a> (reviewed by AIETHOS)` : ''}</p></article>`;
  async function signIn() {
    const c = client(); if (!c) return;
    const { error } = await c.auth.signInWithOAuth({ provider: 'linkedin_oidc', options: { redirectTo: location.origin + location.pathname } });
    if (error) alert('LinkedIn sign-in is not switched on yet: ' + error.message);
  }
  window.AIETHOS_NOTES.signIn = signIn;
  async function mount(el, j, jname) {
    const c = client();
    if (!c) { el.innerHTML = '<p class="cp-msg err">Community notes could not load.</p>'; return; }
    const notes = await listApproved(j);
    const { data: { session } } = await c.auth.getSession();
    let html = `<h2>Community notes</h2><p>Notes from people studying or working on AI ethics in ${esc(jname)}. Every contributor is identified and checked through a LinkedIn profile, and every note is read by a moderator before it appears. Notes are context, not verified law: check the sources above.</p>`;
    html += notes === null ? '<p class="cp-msg err">Notes are unavailable right now.</p>' : notes.length ? notes.map(noteHTML).join('') : '<p class="cp-note">No published notes yet for this jurisdiction.</p>';
    html += '<div id="cn-gate"></div>';
    el.innerHTML = html;
    const gate = el.querySelector('#cn-gate');
    if (!session) {
      gate.innerHTML = '<h3>Add a note</h3><p>Sign in with LinkedIn so we can see who you are. You will then apply once as a contributor; after approval you can submit notes.</p><button class="cp-btn" id="cn-in">Sign in with LinkedIn</button>';
      gate.querySelector('#cn-in').onclick = signIn; return;
    }
    const uid = session.user.id;
    const { data: me } = await c.from('contributors').select('*').eq('user_id', uid).maybeSingle();
    const out = '<button class="cp-btn alt" id="cn-out" type="button">Sign out</button>';
    if (!me) {
      const nm = (session.user.user_metadata && (session.user.user_metadata.name || session.user.user_metadata.full_name)) || '';
      gate.innerHTML = `<h3>Apply as a contributor</h3><form class="cp-form" id="cn-app"><label>Your name<input name="display_name" required minlength="2" maxlength="120" value="${esc(nm)}"></label><label>LinkedIn profile URL (https://www.linkedin.com/in/...)<input name="linkedin_url" required type="url" placeholder="https://www.linkedin.com/in/your-name"></label><label>Your expertise and connection to ${esc(jname)} (10 to 400 characters)<textarea name="expertise" required minlength="10" maxlength="400" rows="3"></textarea></label><label>Country or region you work in<input name="country" required minlength="2" maxlength="60"></label><label style="display:flex;gap:8px;align-items:start"><input type="checkbox" name="consent" required style="width:auto">I agree my name, stated expertise and LinkedIn link are shown beside any note that is published, and that a moderator will review my profile.</label><button class="cp-btn">Submit application</button></form><p id="cn-m"></p>${out}`;
      gate.querySelector('#cn-app').onsubmit = async e => {
        e.preventDefault(); const f = new FormData(e.target);
        const { error } = await c.from('contributors').insert({ user_id: uid, display_name: f.get('display_name').trim(), linkedin_url: f.get('linkedin_url').trim(), expertise: f.get('expertise').trim(), country: f.get('country').trim() });
        gate.querySelector('#cn-m').innerHTML = error ? `<span class="cp-msg err">Could not submit: ${esc(error.message.includes('linkedin_url') ? 'the LinkedIn address must look like https://www.linkedin.com/in/your-name' : error.message)}</span>` : '<span class="cp-msg">Application received. A moderator will review your profile.</span>';
        if (!error) e.target.remove();
      };
    } else if (me.status === 'pending') gate.innerHTML = `<p class="cp-msg">Your contributor application is awaiting review.</p>${out}`;
    else if (me.status === 'rejected') gate.innerHTML = `<p class="cp-msg err">Your contributor application was not approved.${me.moderator_note ? ' ' + esc(me.moderator_note) : ''}</p>${out}`;
    else {
      gate.innerHTML = `<h3>Add a note for ${esc(jname)}</h3><form class="cp-form" id="cn-new"><label>Type<select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label><label>Your note (40 to 2000 characters). Be specific, say what you observed or read, and when.<textarea name="body" required minlength="40" maxlength="2000" rows="6"></textarea></label><label>Source link, if any<input name="source_url" type="url"></label><button class="cp-btn">Submit for moderation</button></form><p id="cn-m"></p>${out}`;
      gate.querySelector('#cn-new').onsubmit = async e => {
        e.preventDefault(); const f = new FormData(e.target);
        const row = { author_id: uid, jurisdiction: j, kind: f.get('kind'), body: f.get('body').trim() }; if (f.get('source_url')) row.source_url = f.get('source_url').trim();
        const { error } = await c.from('notes').insert(row);
        gate.querySelector('#cn-m').innerHTML = error ? `<span class="cp-msg err">Could not submit: ${esc(error.message)}</span>` : '<span class="cp-msg">Thank you. Your note is with the moderator and will appear once approved.</span>';
        if (!error) e.target.reset();
      };
    }
    const o = gate.querySelector('#cn-out'); if (o) o.onclick = async () => { await c.auth.signOut(); mount(el, j, jname); };
  }
  window.AIETHOS_NOTES.mount = mount;
})();

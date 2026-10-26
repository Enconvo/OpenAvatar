// The API page: makes a token (shown this once, with a button to copy it), checks one's calls this month, and
// revokes one. What the API answers only ever goes into the page as text.
const makeForm = document.querySelector('.token-form');
const made = makeForm.querySelector('.token-result');
const checkForm = document.querySelector('.check-form');
const checked = checkForm.querySelector('.check-result');

const UNREACHABLE = "The gallery couldn't be reached. Check your connection and try again.";
const date = iso => new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthName = month => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en', { month: 'long', timeZone: 'UTC' });

function paragraph(text, className) {
  const p = document.createElement('p');
  p.textContent = text;
  if (className) p.className = className;
  return p;
}

async function call(path, init) {
  try {
    const response = await fetch(path, init);
    return { response, body: await response.json().catch(() => ({})) };
  } catch {
    return { response: null, body: { message: UNREACHABLE } };
  }
}

function busy(form, on) {
  for (const button of form.querySelectorAll('button')) button.disabled = on;
}

makeForm.addEventListener('submit', async event => {
  event.preventDefault();
  busy(makeForm, true);
  const name = makeForm.elements.name.value.trim();
  const { response, body } = await call('/api/v1/tokens', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(name ? { name } : {}),
  });
  busy(makeForm, false);
  if (response?.status !== 201) {
    made.replaceChildren(paragraph(body.message || UNREACHABLE));
    return;
  }
  const value = document.createElement('p');
  value.className = 'token-value';
  const code = document.createElement('code');
  code.textContent = body.token;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(body.token);
      copy.textContent = 'Copied';
    } catch {
      // No clipboard (an insecure page, or refused): select it so it can be copied by hand.
      getSelection().selectAllChildren(code);
    }
  });
  value.append(code, copy);
  made.replaceChildren(
    paragraph(`Your token${body.name ? ` for ${body.name}` : ''}. Copy it now: the gallery keeps only a fingerprint of it and can't show it again.`),
    value,
    paragraph(`It has ${body.monthly_limit.toLocaleString('en')} calls a month.`, 'field-note'),
  );
  makeForm.elements.name.value = '';
});

checkForm.addEventListener('submit', async event => {
  event.preventDefault();
  const token = checkForm.elements.token.value.trim();
  if (!token) {
    checked.replaceChildren(paragraph('Paste a token to check it.'));
    return;
  }
  busy(checkForm, true);
  const { response, body } = await call('/api/v1/usage', { headers: { authorization: `Bearer ${token}` } });
  busy(checkForm, false);
  if (!response?.ok) {
    checked.replaceChildren(paragraph(body.message || UNREACHABLE));
    return;
  }
  const who = body.token.name ? `${body.token.shown_as} (${body.token.name})` : body.token.shown_as;
  const used = body.monthly_limit === null
    ? `${body.used.toLocaleString('en')} calls in ${monthName(body.month)}, with no limit.`
    : `${body.used.toLocaleString('en')} of ${body.monthly_limit.toLocaleString('en')} calls used in ${monthName(body.month)}. They start again on ${date(body.resets)}.`;
  const revoke = document.createElement('button');
  revoke.type = 'button';
  revoke.className = 'button';
  revoke.textContent = 'Revoke this token';
  revoke.addEventListener('click', async () => {
    if (!confirm(`Revoke ${body.token.shown_as}? Apps using it stop working at once.`)) return;
    busy(checkForm, true);
    const { response: revoked, body: answer } = await call('/api/v1/tokens/current', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    busy(checkForm, false);
    checked.replaceChildren(paragraph(revoked?.ok ? `${body.token.shown_as} is revoked.` : answer.message || UNREACHABLE));
    if (revoked?.ok) checkForm.elements.token.value = '';
  });
  const actions = document.createElement('p');
  actions.className = 'hero-actions';
  actions.append(revoke);
  checked.replaceChildren(paragraph(`${who}, made on ${date(body.token.created)}.`), paragraph(used), actions);
});

const $ = (id) => document.getElementById(id);
const fmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
const send = (msg) => chrome.runtime.sendMessage(msg);

function host(origin) {
  try { return new URL(origin).hostname.replace(/^www\./, ''); } catch { return origin; }
}

function render(s) {
  $('open').href = `${s.linko}/extension`;
  const ok = s.connected && !s.lastError;
  const status = $('status');
  status.textContent = '';
  const line = document.createElement('div');
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = ok ? 'var(--ok)' : 'var(--danger)';
  line.append(dot, s.connected ? 'Collegata a Linko' : 'Non collegata');
  status.append(line);
  const info = document.createElement('p');
  info.textContent = s.connected
    ? s.lastError || (s.lastRun ? `Ultimo controllo: ${fmt.format(new Date(s.lastRun))} · pagine lette: ${s.checked}` : 'In attesa del primo controllo…')
    : 'Apri Linko → Estensione e premi “Collega questo browser”.';
  status.append(info);

  $('perm').hidden = s.needPermission.length === 0;
  $('perm-list').replaceChildren(...s.needPermission.map((o) => {
    const li = document.createElement('li');
    li.textContent = host(o);
    return li;
  }));

  $('chal').hidden = s.challenged.length === 0;
  $('chal-list').replaceChildren(...s.challenged.map((o) => {
    const row = document.createElement('div');
    row.className = 'row';
    const name = document.createElement('span');
    name.textContent = host(o);
    const a = document.createElement('a');
    a.className = 'btn';
    a.href = o;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Apri il sito';
    row.append(name, a);
    return row;
  }));
}

async function refresh() {
  render(await send({ type: 'hello' }));
}

$('grant').addEventListener('click', async () => {
  const s = await send({ type: 'hello' });
  // Deve partire dal clic: Chrome mostra la richiesta di permesso
  const granted = await chrome.permissions.request({ origins: s.needPermission.map((o) => `${o}/*`) });
  if (granted) {
    $('grant').disabled = true;
    $('grant').textContent = 'Controllo…';
    render(await send({ type: 'poll' }));
    $('grant').disabled = false;
    $('grant').textContent = 'Consenti';
  }
});

$('now').addEventListener('click', async () => {
  $('now').disabled = true;
  $('now').textContent = 'Controllo…';
  render(await send({ type: 'poll' }));
  $('now').disabled = false;
  $('now').textContent = 'Controlla ora';
});

refresh();

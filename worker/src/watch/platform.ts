/**
 * Riconosce i software di forum più diffusi dall'HTML della pagina.
 * Il wizard lo usa per proporre un controllo più frequente (i forum
 * cambiano più in fretta dei siti) e per salvare la fonte come FORUM.
 */

const SIGNATURES: Array<[string, RegExp]> = [
  ['XenForo', /<html[^>]+(id="XF"|data-xf=)|\/js\/xf\/|XenForo/i],
  ['Discourse', /<meta[^>]+name="discourse_|content="Discourse/i],
  ['phpBB', /content="phpBB|ucp\.php\?mode=|phpbb/i],
  ['vBulletin', /vBulletin|vb_login_username|showthread\.php/i],
  ['Invision Community', /ipsApp|Invision Community|ips_/],
  ['Simple Machines', /Simple Machines|smf_scripturl|index\.php\?action=forum/i],
  ['MyBB', /MyBB|mybb_/],
  ['Flarum', /flarum/i],
  ['NodeBB', /NodeBB|nodebb/],
];

export function detectForum(html: string): string | null {
  // Basta l'inizio della pagina: head e intestazione contengono le firme
  const head = html.slice(0, 200_000);
  for (const [name, re] of SIGNATURES) if (re.test(head)) return name;
  return null;
}

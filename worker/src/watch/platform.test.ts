import { describe, expect, it } from 'vitest';
import { detectForum } from './platform';

describe('detectForum', () => {
  it('riconosce i forum più diffusi', () => {
    expect(detectForum('<html data-app="public" data-template="forum_list"><script src="/js/xf/core.js">')).toBe('XenForo');
    expect(detectForum('<meta name="discourse_theme_id" content="2">')).toBe('Discourse');
    expect(detectForum('<a href="./ucp.php?mode=register">Registrati</a>')).toBe('phpBB');
    expect(detectForum('<meta name="generator" content="vBulletin 5.6.4">')).toBe('vBulletin');
    expect(detectForum('<body class="ipsApp ipsApp_front">')).toBe('Invision Community');
  });

  it('un sito qualsiasi non è un forum', () => {
    expect(detectForum('<html><head><title>Notizie</title></head><body><article>…</article></body></html>')).toBeNull();
  });
});

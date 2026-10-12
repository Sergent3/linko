import { describe, expect, it } from 'vitest';
import { applyFilter, normalize, parseFilter } from './filter';

describe('normalize', () => {
  it('rimuove accenti, maiuscole e spazi multipli', () => {
    expect(normalize('  Perché   ÈCCO  ')).toBe('perche ecco');
  });
});

describe('parseFilter', () => {
  it('riconosce parole, frasi, tag ed esclusioni', () => {
    const terms = parseFilter('docker "zfs pool" #Proxmox -request -"for sale"');
    expect(terms.map((t) => [t.kind, t.value, t.exclude])).toEqual([
      ['word', 'docker', false],
      ['phrase', 'zfs pool', false],
      ['tag', 'proxmox', false],
      ['word', 'request', true],
      ['phrase', 'for sale', true],
    ]);
  });

  it('accetta anche le virgole come separatore', () => {
    expect(parseFilter('a, b,c').map((t) => t.value)).toEqual(['a', 'b', 'c']);
  });

  it('ignora input vuoto', () => {
    expect(parseFilter('   ')).toEqual([]);
  });
});

describe('applyFilter', () => {
  const f = (expr: string, title: string, tags?: string[]) => applyFilter(parseFilter(expr), { title, tags });

  it('senza termini passa tutto', () => {
    expect(f('', 'qualsiasi titolo')).toEqual({ matched: true, matchedTerms: [] });
  });

  it('parola a confine di parola, senza maiuscole e accenti', () => {
    expect(f('citta', 'Nuova CITTÀ digitale').matched).toBe(true);
    expect(f('art', 'An article about X').matched).toBe(false);
  });

  it('frase esatta', () => {
    expect(f('"zfs pool"', 'Help with ZFS pool import').matched).toBe(true);
    expect(f('"zfs pool"', 'pool of zfs disks').matched).toBe(false);
  });

  it('tag nativo confrontato solo con i tag', () => {
    expect(f('#proxmox', 'Titolo qualunque', ['Proxmox', 'ceph']).matched).toBe(true);
    expect(f('#proxmox', 'proxmox nel titolo', []).matched).toBe(false);
  });

  it('OR tra i termini inclusivi e riporta quelli corrispondenti', () => {
    expect(f('docker kubernetes #k8s', 'Docker on Kubernetes', ['k8s'])).toEqual({
      matched: true,
      matchedTerms: ['docker', 'kubernetes', '#k8s'],
    });
  });

  it('le esclusioni vincono sulle inclusioni', () => {
    expect(f('docker -request', 'Docker image request').matched).toBe(false);
    expect(f('docker -"for sale"', 'Docker server for sale').matched).toBe(false);
  });

  it('solo esclusioni: passa ciò che non è escluso', () => {
    expect(f('-request', 'Nuovo tutorial').matched).toBe(true);
    expect(f('-request', 'Request: tutorial').matched).toBe(false);
  });

  it('i caratteri speciali nei termini non rompono la regex', () => {
    expect(f('c++', 'Learning C++ today').matched).toBe(true);
  });
});

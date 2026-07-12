import { useEffect, useState } from 'react';
import { fetchOwnProfile, saveUsername, USERNAME_RE } from '../lib/profile';
import { fetchTopScores, type RankingEntry } from '../lib/ranking';

interface RankingScreenProps {
  onBack: () => void;
}

type NameFormState = { mode: 'view' } | { mode: 'edit'; draft: string; error: string | null; saving: boolean };

// RF-13: Top 10 (leitura pública) + T07D-02: nome de exibição opcional
// (username em `profiles`), editável inline pelo próprio jogador.
export function RankingScreen({ onBack }: RankingScreenProps) {
  const [entries, setEntries] = useState<RankingEntry[] | null>(null);
  const [ownUsername, setOwnUsername] = useState<string | null | undefined>(undefined);
  const [nameForm, setNameForm] = useState<NameFormState>({ mode: 'view' });

  useEffect(() => {
    fetchTopScores().then(setEntries);
    fetchOwnProfile().then((profile) => setOwnUsername(profile?.username ?? null));
  }, []);

  function startEditing() {
    setNameForm({ mode: 'edit', draft: ownUsername ?? '', error: null, saving: false });
  }

  function cancelEditing() {
    setNameForm({ mode: 'view' });
  }

  async function handleSaveName() {
    if (nameForm.mode !== 'edit') return;
    const draft = nameForm.draft.trim();

    if (!USERNAME_RE.test(draft)) {
      setNameForm({ ...nameForm, error: '3–16 letras, números ou _' });
      return;
    }

    setNameForm({ ...nameForm, saving: true, error: null });
    const result = await saveUsername(draft);

    if (!result.ok) {
      const message =
        result.reason === 'taken'
          ? 'esse nome já tem dono'
          : result.reason === 'invalid'
            ? '3–16 letras, números ou _'
            : 'erro ao salvar, tenta de novo';
      setNameForm({ mode: 'edit', draft, error: message, saving: false });
      return;
    }

    setOwnUsername(draft);
    setNameForm({ mode: 'view' });
    // Nome pode ter afetado o Top 10 exibido (se o jogador estiver nele).
    fetchTopScores().then(setEntries);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-slate-900 p-6 text-white">
      <header className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">Ranking</h1>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium"
        >
          ← Menu
        </button>
      </header>

      <section className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Seu nome no ranking</p>
        {nameForm.mode === 'view' ? (
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {ownUsername === undefined ? 'Carregando…' : (ownUsername ?? 'definir nome')}
            </span>
            {ownUsername !== undefined && (
              <button
                type="button"
                onClick={startEditing}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium"
              >
                {ownUsername ? 'Editar' : 'Definir'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={nameForm.draft}
                onChange={(e) => setNameForm({ ...nameForm, draft: e.target.value, error: null })}
                maxLength={16}
                placeholder="seu_nome"
                autoFocus
                className="min-w-0 flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm outline-none ring-1 ring-slate-600 focus:ring-slate-400"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={nameForm.saving}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={nameForm.saving}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
            {nameForm.error && <p className="text-sm text-red-400">{nameForm.error}</p>}
          </div>
        )}
      </section>

      <ol className="w-full max-w-sm space-y-2">
        {entries === null && <p className="text-center text-slate-400">Carregando…</p>}
        {entries?.length === 0 && (
          <p className="text-center text-slate-400">Ninguém pontuou ainda. Seja o primeiro!</p>
        )}
        {entries?.map((entry, i) => (
          <li
            key={`${entry.created_at}-${i}`}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
          >
            <span className="w-8 shrink-0 font-mono text-slate-400">#{i + 1}</span>
            <span className="flex-1 truncate px-2 text-left">
              {entry.username ? (
                entry.username
              ) : (
                <span className="italic text-slate-500">Anônimo</span>
              )}
            </span>
            <span className="font-bold">
              {entry.score} pts
              {/* selo (D-17): recorde limpo, sem revive pago com propinas */}
              {!entry.continue_used && (
                <span title="sem continue" aria-label="sem continue">
                  {' '}
                  🏅
                </span>
              )}
            </span>
            <span className="text-right text-sm text-slate-400">
              {'⭐'.repeat(entry.stars ?? 1)}
              <br />
              {entry.votes} votos · {entry.distance}m · {(entry.world ?? 'sp').toUpperCase()}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}

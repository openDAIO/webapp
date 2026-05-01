import { Coins, Medal, ShieldCheck, TrendingUp, Users } from 'lucide-react';

const stats = [
  { label: 'Participation Count', value: '1,248', detail: 'posted entries', icon: Users, accent: 'mint' },
  { label: 'Prize Pool', value: '42,800 TOK', detail: 'open treasury', icon: Coins, accent: 'gold' },
  { label: 'Avg. Credibility', value: '86%', detail: 'verified signal', icon: ShieldCheck, accent: 'sky' },
  { label: 'Reviewer Earnings', value: '9,420 TOK', detail: 'claimed rewards', icon: TrendingUp, accent: 'coral' },
];

const rankings = [
  { name: 'Citation Cy', score: 96, trust: 94, earnings: '1,260 TOK', ribbon: 'Top notice' },
  { name: 'Alpha June', score: 94, trust: 91, earnings: '1,120 TOK', ribbon: 'Fast read' },
  { name: 'Peer Piper', score: 92, trust: 89, earnings: '980 TOK', ribbon: 'Consensus' },
  { name: 'Signal Sera', score: 89, trust: 87, earnings: '860 TOK', ribbon: 'Steady' },
];

const prizeNotes = [
  { label: 'Round pool', value: '18,400 TOK' },
  { label: 'Slashing reserve', value: '3,600 TOK' },
  { label: 'Next payout', value: 'After final consensus' },
];

export default function DashboardPage() {
  return (
    <main className="dashboard-square h-screen overflow-y-auto overflow-x-hidden text-[#3f2818]">
      <span className="dashboard-image-border dashboard-image-border--left" aria-hidden="true" />
      <span className="dashboard-image-border dashboard-image-border--right" aria-hidden="true" />
      <span className="dashboard-image-border dashboard-image-border--bottom" aria-hidden="true" />
      <span className="dashboard-image-border dashboard-image-border--top" aria-hidden="true" />

      <section className="dashboard-wood-shell" aria-labelledby="dashboard-board-title">
        <header className="dashboard-board-header">
          <div>
            <p>Reviewer economy</p>
            <h1 id="dashboard-board-title">Dashboard</h1>
          </div>
        </header>

        <section className="dashboard-board-surface">
          <article className="dashboard-note dashboard-note--feature">
            <span className="dashboard-note__pin dashboard-note__pin--red" />
            <div className="dashboard-note__eyebrow">Open review rooms</div>
            <div className="dashboard-note__headline">42 active notices</div>
            <p>
              Peer reviewers are gathering signals across paper and judgment rooms.
            </p>
            <div className="dashboard-note__stamp">Live</div>
          </article>

          <section className="dashboard-stat-grid" aria-label="Reviewer economy stats">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <article key={stat.label} className={`dashboard-note dashboard-stat-note dashboard-note--${stat.accent}`}>
                  <span className="dashboard-note__pin" />
                  <div className="dashboard-stat-note__icon">
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="dashboard-stat-note__value">{stat.value}</div>
                    <div className="dashboard-stat-note__label">{stat.label}</div>
                    <div className="dashboard-stat-note__detail">{stat.detail}</div>
                  </div>
                </article>
              );
            })}
          </section>

          <article className="dashboard-note dashboard-ranking-note">
            <span className="dashboard-note__pin dashboard-note__pin--blue" />
            <div className="dashboard-note__title-row">
              <Medal size={21} />
              <h3>Node Rankings</h3>
            </div>
            <div className="dashboard-ranking-list">
              {rankings.map((node, index) => (
                <div key={node.name} className="dashboard-ranking-row">
                  <span className="dashboard-ranking-row__rank">#{index + 1}</span>
                  <span className="dashboard-ranking-row__name">{node.name}</span>
                  <span className="dashboard-ranking-row__ribbon">{node.ribbon}</span>
                  <span className="dashboard-ranking-row__metric dashboard-ranking-row__metric--score">{node.score}</span>
                  <span className="dashboard-ranking-row__metric dashboard-ranking-row__metric--trust">{node.trust}%</span>
                  <span className="dashboard-ranking-row__earnings">{node.earnings}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-note dashboard-prize-note">
            <span className="dashboard-note__pin dashboard-note__pin--green" />
            <div className="dashboard-note__title-row">
              <Coins size={21} />
              <h3>Prize Info</h3>
            </div>
            <div className="dashboard-prize-note__list">
              {prizeNotes.map((note) => (
                <div key={note.label} className="dashboard-prize-note__item">
                  <span>{note.label}</span>
                  <strong>{note.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

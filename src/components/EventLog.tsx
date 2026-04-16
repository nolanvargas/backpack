import type { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

export default function EventLog({ logs }: Props) {
  return (
    <footer className="log-bar">
      <div className="log-title">EVENT LOG</div>
      <div className="event-log">
        {logs.map(entry => (
          <div key={entry.id} className={`log-entry log--${entry.type}`}>
            <span className="log-time">[{entry.time}]</span>
            <span className="log-msg">{entry.msg}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}

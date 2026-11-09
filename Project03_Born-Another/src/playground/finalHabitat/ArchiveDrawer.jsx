import FossilPlate from './FossilPlate.jsx'
import { describeEnvironment } from './archive.js'

/**
 * The viewer's archive of kept specimens (lives they witnessed end).
 * A quiet side drawer over the habitat; the world keeps living behind it.
 */
export default function ArchiveDrawer({ entries, onClose, onRemove }) {
  return (
    <aside className="exp07-archive" aria-labelledby="exp07-archive-title">
      <header className="exp07-archive__head">
        <h2 id="exp07-archive-title">Archive</h2>
        <button type="button" className="exp07-archive__close" onClick={onClose} aria-label="Close archive">
          ×
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="exp07-archive__empty">
          Nothing kept yet. When a life you are watching ends, you can save its remains here.
        </p>
      ) : (
        <ol className="exp07-archive__list">
          {entries.map((e, i) => (
            <li key={e.key} className="exp07-archive__item">
              <div className="exp07-archive__plate" aria-hidden="true">
                {e.fossilId ? <FossilPlate id={e.fossilId} /> : null}
              </div>
              <div className="exp07-archive__text">
                <p className="exp07-archive__no">No. {String(entries.length - i).padStart(3, '0')}</p>
                <h3>
                  {e.name}
                  <span>{e.latin}</span>
                </h3>
                <p>Lived in {describeEnvironment(e.environment)} water · crystallized {Math.round((e.crystallization ?? 0) * 100)}%</p>
                <p className="exp07-archive__date">
                  Kept {new Date(e.savedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button type="button" className="exp07-archive__remove" onClick={() => onRemove(e.key)} aria-label={`Remove ${e.name} from the archive`}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="exp07-archive__note">Kept in this browser.</p>
    </aside>
  )
}

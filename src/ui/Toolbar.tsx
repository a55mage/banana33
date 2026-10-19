import { useRef } from 'react'
import {
  faArrowPointer,
  faArrowsRotate,
  faExpand,
  faUpDownLeftRight,
  faCircleHalfStroke,
  faBorderAll,
  faScissors,
  faGripLines,
  faCouch,
  faCrosshairs,
  faCube,
  faDownload,
  faFolderOpen,
  faKeyboard,
  faLanguage,
  faMap,
  faMoon,
  faPenRuler,
  faRotateLeft,
  faRotateRight,
  faSquarePlus,
  faSun,
  faTriangleExclamation,
  faUpload,
} from '@fortawesome/free-solid-svg-icons'
import { useProject, setUnit } from '../store/projectStore'
import { useUi, type GizmoMode, type WallMode } from '../store/uiStore'
import { downloadProject, FILE_EXT, readProjectFile } from '../persistence/file'
import { newProject, sampleProject } from '../model/factory'
import type { Unit } from '../model/schema'
import { formatLength, SNAP_STEPS, UNITS, useUnit } from '../units'
import { useThemePref, type ThemePref } from '../theme'
import { getT, LANG_LABELS, useLang, useT, type Lang } from '../i18n'
import { Icon } from './Icon'
import { Menu } from './Menu'

const GIZMOS: { id: GizmoMode; icon: typeof faSun }[] = [
  { id: 'none', icon: faArrowPointer },
  { id: 'translate', icon: faUpDownLeftRight },
  { id: 'rotate', icon: faArrowsRotate },
  { id: 'scale', icon: faExpand },
]

const WALL_MODES: { id: WallMode; icon: typeof faSun }[] = [
  { id: 'up', icon: faBorderAll },
  { id: 'cutaway', icon: faScissors },
  { id: 'down', icon: faGripLines },
]

const THEMES: Record<ThemePref, { icon: typeof faSun; next: ThemePref }> = {
  system: { icon: faCircleHalfStroke, next: 'light' },
  light: { icon: faSun, next: 'dark' },
  dark: { icon: faMoon, next: 'system' },
}

function ThemeToggle() {
  const t = useT()
  const pref = useThemePref((s) => s.pref)
  const theme = THEMES[pref]
  return (
    <button className="icon-btn" onClick={() => useThemePref.getState().setPref(theme.next)} title={t.toolbar.themeTitle(t.toolbar.theme[pref])}>
      <Icon icon={theme.icon} />
    </button>
  )
}

function LanguageSelect() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  return (
    <label className="inline select-with-icon" title={t.toolbar.language}>
      <Icon icon={faLanguage} />
      <select value={lang} onChange={(e) => useLang.getState().setLang(e.target.value as Lang)} aria-label={t.toolbar.language}>
        {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
          <option key={l} value={l}>
            {LANG_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Toolbar() {
  const t = useT()
  const name = useProject((s) => s.project.name)
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  const view = useUi((s) => s.view)
  const snap = useUi((s) => s.snap)
  const showCollisions = useUi((s) => s.showCollisions)
  const gizmo = useUi((s) => s.gizmo)
  const wallMode = useUi((s) => s.wallMode)
  const unit = useUnit()
  const snaps = SNAP_STEPS[UNITS[unit].system]
  const { setTool, setView, setSnap } = useUi.getState()
  const fileInput = useRef<HTMLInputElement>(null)

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    try {
      const p = await readProjectFile(file)
      useProject.getState().load(p)
    } catch (err) {
      alert(getT().app.invalidFile(err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <header className="toolbar">
      <div className="group">
        <strong className="brand">
          <span className="brand-mark" aria-hidden="true" />
          banana33
        </strong>
        <input
          className="project-name"
          value={name}
          onChange={(e) => useProject.getState().mutate((d) => void (d.name = e.target.value), { history: false })}
          aria-label={t.app.projectName}
        />
      </div>

      <div className="group">
        <Menu
          icon={faFolderOpen}
          label={t.toolbar.project}
          items={[
            { icon: faSquarePlus, label: t.toolbar.newSpace, title: t.toolbar.newSpaceTitle, onSelect: () => useProject.getState().load(newProject('space')) },
            {
              icon: faPenRuler,
              label: t.toolbar.newPlan,
              title: t.toolbar.newPlanTitle,
              onSelect: () => {
                useProject.getState().load(newProject('plan'))
                setTool('wall')
              },
            },
            { icon: faCouch, label: t.toolbar.sample, title: t.toolbar.sampleTitle, onSelect: () => useProject.getState().load(sampleProject()) },
            'separator',
            { icon: faDownload, label: t.toolbar.download, title: t.toolbar.downloadTitle, onSelect: () => downloadProject(useProject.getState().project) },
            { icon: faUpload, label: t.toolbar.upload, title: t.toolbar.uploadTitle, onSelect: () => fileInput.current?.click() },
          ]}
        />
        <input
          ref={fileInput}
          type="file"
          accept={`${FILE_EXT},.json,application/json`}
          hidden
          onChange={(e) => {
            void onUpload(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <div className="group">
        <button className="icon-btn" disabled={!canUndo} onClick={() => useProject.getState().undo()} title={t.toolbar.undo} aria-label={t.toolbar.undo}>
          <Icon icon={faRotateLeft} />
        </button>
        <button className="icon-btn" disabled={!canRedo} onClick={() => useProject.getState().redo()} title={t.toolbar.redo} aria-label={t.toolbar.redo}>
          <Icon icon={faRotateRight} />
        </button>
      </div>

      <div className="group">
        <label className="inline">
          {t.toolbar.unit}
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {(Object.keys(UNITS) as Unit[]).map((u) => (
              <option key={u} value={u}>
                {UNITS[u].label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline">
          {t.toolbar.snap}
          <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
            {!snaps.includes(snap) && <option value={snap}>{formatLength(snap, unit)}</option>}
            {snaps.map((v) => (
              <option key={v} value={v}>
                {v === 0 ? t.toolbar.snapFree : formatLength(v, unit, 2)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="group">
        <div className="segmented">
          <button className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')} title="2D (2)">
            <Icon icon={faMap} /> 2D
          </button>
          <button className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')} title="3D (3)">
            <Icon icon={faCube} /> 3D
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Gizmo">
          {GIZMOS.map((g) => (
            <button
              key={g.id}
              className={`icon-btn${gizmo === g.id ? ' active' : ''}`}
              aria-pressed={gizmo === g.id}
              onClick={() => useUi.getState().setGizmo(g.id)}
              title={t.toolbar.gizmo[g.id]}
              aria-label={t.toolbar.gizmo[g.id]}
            >
              <Icon icon={g.icon} />
            </button>
          ))}
        </div>
        {view === '3d' && (
          <div className="segmented" role="group" aria-label={t.toolbar.walls}>
            {WALL_MODES.map((m) => (
              <button
                key={m.id}
                className={`icon-btn${wallMode === m.id ? ' active' : ''}`}
                aria-pressed={wallMode === m.id}
                onClick={() => useUi.getState().setWallMode(m.id)}
                title={`${t.toolbar.wallMode[m.id]} ${t.toolbar.wallModeHint}`}
                aria-label={t.toolbar.wallMode[m.id]}
              >
                <Icon icon={m.icon} />
              </button>
            ))}
          </div>
        )}
        <button onClick={() => useUi.getState().requestFit()} title={t.toolbar.centerTitle}>
          <Icon icon={faCrosshairs} /> {t.toolbar.center}
        </button>
        <button
          className={`toggle${showCollisions ? ' on' : ''}`}
          aria-pressed={showCollisions}
          onClick={() => useUi.getState().toggleCollisions()}
          title={t.toolbar.collisionsTitle(showCollisions)}
        >
          <Icon icon={faTriangleExclamation} /> {t.toolbar.collisions}
        </button>
      </div>

      <div className="group end">
        <LanguageSelect />
        <ThemeToggle />
        <button className="icon-btn" onClick={() => useUi.getState().setShowHelp(true)} title={t.toolbar.help} aria-label={t.toolbar.help}>
          <Icon icon={faKeyboard} />
        </button>
      </div>
    </header>
  )
}

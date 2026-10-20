import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faArrowsSpin,
  faBath,
  faCat,
  faDog,
  faDove,
  faFire,
  faLeaf,
  faStairs,
  faTent,
  faTree,
  faUmbrellaBeach,
  faWaterLadder,
  faBed,
  faBookOpen,
  faBox,
  faBoxArchive,
  faChair,
  faComputer,
  faCouch,
  faCube,
  faDatabase,
  faKitchenSet,
  faLightbulb,
  faPallet,
  faRug,
  faSeedling,
  faShower,
  faSink,
  faToilet,
  faTv,
} from '@fortawesome/free-solid-svg-icons'
import type { PresetId } from '../model/factory'

/** Icona Font Awesome oppure emoji, quando FA non ha nulla di adatto */
export type IconSource = IconDefinition | string

export function Icon({ icon, className }: { icon: IconSource; className?: string }) {
  if (typeof icon === 'string') {
    return (
      <span className={`emoji-icon ${className ?? ''}`} aria-hidden="true">
        {icon}
      </span>
    )
  }
  return <FontAwesomeIcon icon={icon} className={className} fixedWidth />
}

export const PRESET_ICONS: Record<PresetId, IconSource> = {
  cube: faCube,
  cylinder: faDatabase,
  sphere: '⚪',
  stairs: faStairs,
  spiralStairs: faArrowsSpin,
  sofa3: faCouch,
  sofa2: faCouch,
  armchair: '💺',
  coffeeTable: '☕',
  tvStand: '🗄️',
  tv: faTv,
  bookshelf: faBookOpen,
  rug: faRug,
  plant: faSeedling,
  floorLamp: faLightbulb,
  bedDouble: faBed,
  bedSingle: faBed,
  nightstand: '🛏️',
  wardrobe: '🚪',
  dresser: faBoxArchive,
  kitchen: faKitchenSet,
  kitchenBase: faKitchenSet,
  fridge: '🧊',
  table: '🍽️',
  roundTable: '🍽️',
  chair: faChair,
  toilet: faToilet,
  washbasin: faSink,
  bathtub: faBath,
  shower: faShower,
  washer: '🧺',
  desk: faComputer,
  officeChair: faChair,
  pallet: faPallet,
  carton: faBox,
  tree: faTree,
  pine: '🌲',
  bush: '🌿',
  hedge: faLeaf,
  pool: faWaterLadder,
  gazebo: faTent,
  parasol: faUmbrellaBeach,
  lounger: '🏖️',
  bench: '🪑',
  bbq: faFire,
  dog: faDog,
  cat: faCat,
  pigeon: faDove,
  banana: '🍌',
}

import { WorkoutRunner } from './workout-runner'

// Cascarón sin datos: toda la información se lee del móvil (IndexedDB) o de /api/snapshot,
// de modo que esta pantalla funciona también sin conexión.
export const metadata = { title: 'Entrenament' }

export default function WorkoutPage() {
  return <WorkoutRunner />
}

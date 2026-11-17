import './style.css'
import { setupCounter } from './counter.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<p>Hello Cache World</p>
<button id="counter"></button>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)

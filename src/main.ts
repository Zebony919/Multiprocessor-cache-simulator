import './style.css'
import { Memory } from './memory.ts';
import { SetAssociativeCache } from './cache.ts';
import { System, type StepResult, type Op } from './system.ts';

let numCaches = 2;
const memory = new Memory();
const system = new System(numCaches, memory);

memory.write(0x0000, 12);

const program: Op[] = [
    { cacheId: 0, type: 'R', address: 0x0000 },
    { cacheId: 0, type: 'W', address: 0x0000, value: 99 },

    { cacheId: 1, type: 'R', address: 0x0000 },
    { cacheId: 1, type: 'W', address: 0x0000, value: 50 },
];

system.load(program);

function render(lastStep: StepResult | null): void {
    // Render current step of whole application
    const cacheDiv = document.getElementById("caches");
    cacheDiv!.replaceChildren();

    for (let i = 0; i < numCaches; i++) {
        cacheDiv!.appendChild(renderCache(system.fetchCache(i)));
    }
};

function renderCache(cache: SetAssociativeCache): HTMLElement {
    // Render a single cache
    const table = document.createElement("table");
    const body = table.createTBody();

    const headerRow = body.insertRow();
    headerRow.insertCell().textContent = "Set/Way";
    headerRow.insertCell().textContent = "State";
    headerRow.insertCell().textContent = "Tag";

    const dataHeader = document.createElement("td");
    dataHeader.colSpan = 4;
    dataHeader.textContent = "Data";
    dataHeader.style.textAlign = "center";
    headerRow.appendChild(dataHeader);

    for (let set = 0; set < cache.numSets; set++) {
        for (let way = 0; way < cache.numWays; way++) {
            const foundLine = cache.fetchLineIndicies(set, way);
            const data = foundLine.data;

            const row = body.insertRow();
            row.insertCell().textContent = `${set}/${way}`;
            row.insertCell().textContent = foundLine.state;
            row.insertCell().textContent = String(foundLine.tag);

            data.forEach((value: number) => {
                const cell = row.insertCell();
                cell.textContent = String(value);
            })
        }
    }

    return table;
};

const stepButton = document.getElementById("step");
stepButton!.addEventListener('click', () => {
    // Move Cache through one step in the program
    const curStep = system.step();

    if (curStep != null) {
        render(curStep);
    }
});

const resetButton = document.getElementById("reset");
resetButton!.addEventListener('click', () => {
    system.clearCaches();
    system.load(program);
    render(null);
});

const previousButton = document.getElementById("previous");
previousButton!.addEventListener('click', () => {
    // move back one step in the program by resetting and running n - 1 steps
    const oldPc = system.pc;

    system.clearCaches();
    system.load(program);

    for (let i = 0; i < oldPc - 1; i++) {
        system.step();
    }

    render(null);
})

render(null);
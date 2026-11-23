export class Memory {
    private data: Map<number, number> = new Map<number, number>();

    public read(address: number): number | null {
        return this.data.get(address) ?? null;
    };

    public write(address: number, value: number): void {
        this.data.set(address, value);
    }
}
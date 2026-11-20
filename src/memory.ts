export class Memory {
    private data = new Map<number, number>();

    public read(address: number): number {
        return this.data.get(address) ?? 0;
    };

    public write(address: number, value: number): void {
        this.data.set(address, value);
    }
}
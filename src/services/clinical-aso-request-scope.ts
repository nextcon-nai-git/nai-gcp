export class ClinicalAsoRequestScope {
  private key = "";
  private generation = 0;

  update(key: string) {
    if (this.key !== key) {
      this.key = key;
      this.generation += 1;
    }
    return this.generation;
  }

  capture() {
    return this.generation;
  }

  isCurrent(generation: number) {
    return generation === this.generation;
  }
}

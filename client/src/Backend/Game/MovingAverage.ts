export class MovingAverage {
  name: string | null;
  movingAverage: number[];
  defaultValue: number;
  constructor(name: string | null, defaultValue: number) {
    this.name = name;
    this.defaultValue = defaultValue;
    const savedAverage: string | null = name && localStorage.getItem("ma-" + name);
    if (savedAverage) {
      this.movingAverage = JSON.parse(savedAverage);
    } else {
      this.movingAverage = [];
    }
  }
  addStat(stat: number) {
    this.movingAverage.push(stat);
    while (this.movingAverage.length > 10) {
      this.movingAverage.splice(0, 1);
    }
    if (this.name) {
      localStorage.setItem("ma-" + this.name, JSON.stringify(this.movingAverage));
    }
  }
  getAverage() {
    if (this.movingAverage.length === 0) {
      return this.defaultValue;
    }
    let sum = 0;
    for (const s of this.movingAverage) {
      sum += s;
    }
    return sum / this.movingAverage.length;
  }
}

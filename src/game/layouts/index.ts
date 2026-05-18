import { TourConfig } from "./TourConfig";
import { tour1 } from "./tours/tour1";
import { tour2 } from "./tours/tour2";
import { tour3 } from "./tours/tour3";
import { tour4 } from "./tours/tour4";
import { tour5 } from "./tours/tour5";
import { tour6 } from "./tours/tour6";
import { tour7 } from "./tours/tour7";
import { tour8 } from "./tours/tour8";
import { tour9 } from "./tours/tour9";
import { tour10 } from "./tours/tour10";
import { tour11 } from "./tours/tour11";
import { tour12 } from "./tours/tour12";
import { tour13 } from "./tours/tour13";
import { tour14 } from "./tours/tour14";
import { tour15 } from "./tours/tour15";
import { tour16 } from "./tours/tour16";
import { tour17 } from "./tours/tour17";
import { tour18 } from "./tours/tour18";
import { tour19 } from "./tours/tour19";
import { tour20 } from "./tours/tour20";

export const TOURS: Record<number, TourConfig> = {
  1: tour1,
  2: tour2,
  3: tour3,
  4: tour4,
  5: tour5,
  6: tour6,
  7: tour7,
  8: tour8,
  9: tour9,
  10: tour10,
  11: tour11,
  12: tour12,
  13: tour13,
  14: tour14,
  15: tour15,
  16: tour16,
  17: tour17,
  18: tour18,
  19: tour19,
  20: tour20,
};

export const LEVEL_LAYOUTS: Record<number, string> = {
  1: tour1.layout,
  2: tour2.layout,
  3: tour3.layout,
  4: tour4.layout,
  5: tour5.layout,
  6: tour6.layout,
  7: tour7.layout,
  8: tour8.layout,
  9: tour9.layout,
  10: tour10.layout,
  11: tour11.layout,
  12: tour12.layout,
  13: tour13.layout,
  14: tour14.layout,
  15: tour15.layout,
  16: tour16.layout,
  17: tour17.layout,
  18: tour18.layout,
  19: tour19.layout,
  20: tour20.layout,
};

export { getProceduralBrick } from "./generator";

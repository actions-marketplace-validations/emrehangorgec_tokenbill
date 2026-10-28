// The suite predates token mode and pins the dollar math, so in-process tests
// run with --cost semantics; test/units.test.ts covers the token default.
import { setUnit } from "../src/unit.js";

setUnit("usd");

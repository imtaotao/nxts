import type { Rule } from "../../types";

export const nonNullAssertionRule: Rule = {
  name: "nonNullAssertion",
  check: () => {
    return null;
  },
};

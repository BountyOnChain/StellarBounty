import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import "./mocks/next";

expect.extend(toHaveNoViolations);

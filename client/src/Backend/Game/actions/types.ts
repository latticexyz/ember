import { ActionContext } from "../ActionContext";

export type ActionCreator<DataType, ActionType> = (data: DataType, context: ActionContext) => ActionType;

export interface Assertion {
  check: () => boolean;
  errorMessage: string;
}

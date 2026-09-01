export class ScheduleDataUnavailableError extends Error {
  constructor() {
    super("Ajakava andmed pole saadaval.");
    this.name = "ScheduleDataUnavailableError";
  }
}

export class ScheduleRevisionConflictError extends Error {
  readonly currentRevision: number;

  constructor(currentRevision: number) {
    super("Ajakava on vahepeal muudetud.");
    this.name = "ScheduleRevisionConflictError";
    this.currentRevision = currentRevision;
  }
}

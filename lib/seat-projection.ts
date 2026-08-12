export const RIIGIKOGU_SEAT_COUNT = 101;
export const RIIGIKOGU_ELECTORAL_THRESHOLD = 5;
export const RIIGIKOGU_DHONDT_EXPONENT = 0.9;

export type PartyRating = {
  id: string;
  name: string;
  support: number;
};

export type HighestAveragesOptions = {
  seats: number;
  threshold?: number;
  exponent?: number;
};

export type ProjectedParty = PartyRating & {
  seats: number;
};

export type ExcludedParty = PartyRating & {
  reason: "below-threshold";
};

export type ProjectionAssumptions = {
  method: "highest-averages";
  seats: number;
  threshold: number;
  thresholdInclusive: true;
  exponent: number;
  tieBreaker: "party-id-ascending";
};

export type SeatProjectionResult = {
  projection: ProjectedParty[];
  excluded: ExcludedParty[];
  assumptions: ProjectionAssumptions;
};

type AllocationParty = PartyRating & {
  seats: number;
};

function comparePartyIds(left: PartyRating, right: PartyRating): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

function compareProjectionOrder(left: ProjectedParty, right: ProjectedParty): number {
  return right.seats - left.seats
    || right.support - left.support
    || comparePartyIds(left, right);
}

function compareExcludedOrder(left: ExcludedParty, right: ExcludedParty): number {
  return right.support - left.support || comparePartyIds(left, right);
}

function validateOptions(options: HighestAveragesOptions): Required<HighestAveragesOptions> {
  const threshold = options.threshold ?? 0;
  const exponent = options.exponent ?? 1;

  if (!Number.isInteger(options.seats) || options.seats < 0) {
    throw new RangeError("seats must be a non-negative integer");
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError("threshold must be a finite, non-negative number");
  }
  if (!Number.isFinite(exponent) || exponent <= 0) {
    throw new RangeError("exponent must be a finite number greater than zero");
  }

  return { seats: options.seats, threshold, exponent };
}

function copyAndValidateRatings(ratings: readonly PartyRating[]): PartyRating[] {
  const ids = new Set<string>();

  return ratings.map((rating, index) => {
    if (typeof rating.id !== "string" || rating.id.length === 0) {
      throw new TypeError(`ratings[${index}].id must be a non-empty string`);
    }
    if (ids.has(rating.id)) {
      throw new RangeError(`duplicate party id: ${rating.id}`);
    }
    if (!Number.isFinite(rating.support) || rating.support < 0) {
      throw new RangeError(`support for party ${rating.id} must be finite and non-negative`);
    }

    ids.add(rating.id);
    return {
      id: rating.id,
      name: rating.name,
      support: rating.support,
    };
  });
}

/**
 * Allocates seats using a highest-averages divisor series of 1^e, 2^e, 3^e, ...
 * Ratings at exactly the threshold are eligible. Exact quotient ties are resolved
 * by ascending party ID so allocation does not depend on input order.
 */
export function allocateHighestAverages(
  ratings: readonly PartyRating[],
  options: HighestAveragesOptions,
): SeatProjectionResult {
  const { seats, threshold, exponent } = validateOptions(options);
  const copiedRatings = copyAndValidateRatings(ratings);
  const eligible: AllocationParty[] = copiedRatings
    .filter((rating) => rating.support >= threshold)
    .sort(comparePartyIds)
    .map((rating) => ({ ...rating, seats: 0 }));
  const excluded: ExcludedParty[] = copiedRatings
    .filter((rating) => rating.support < threshold)
    .map((rating): ExcludedParty => ({ ...rating, reason: "below-threshold" }))
    .sort(compareExcludedOrder);

  if (seats > 0 && eligible.length === 0) {
    throw new RangeError("cannot allocate seats because no party meets the threshold");
  }

  for (let seat = 0; seat < seats; seat += 1) {
    let winner = eligible[0];
    let winningQuotient = winner.support / Math.pow(winner.seats + 1, exponent);

    for (let index = 1; index < eligible.length; index += 1) {
      const candidate = eligible[index];
      const quotient = candidate.support / Math.pow(candidate.seats + 1, exponent);
      if (quotient > winningQuotient) {
        winner = candidate;
        winningQuotient = quotient;
      }
    }

    winner.seats += 1;
  }

  return {
    projection: eligible.map((party) => ({ ...party })).sort(compareProjectionOrder),
    excluded,
    assumptions: {
      method: "highest-averages",
      seats,
      threshold,
      thresholdInclusive: true,
      exponent,
      tieBreaker: "party-id-ascending",
    },
  };
}

/**
 * National polling approximation for the 101-seat Riigikogu. Estonia's actual
 * election result also depends on district and personal mandates, which cannot
 * be derived from nationwide party ratings alone.
 */
export function projectRiigikoguSeats(
  ratings: readonly PartyRating[],
): SeatProjectionResult {
  return allocateHighestAverages(ratings, {
    seats: RIIGIKOGU_SEAT_COUNT,
    threshold: RIIGIKOGU_ELECTORAL_THRESHOLD,
    exponent: RIIGIKOGU_DHONDT_EXPONENT,
  });
}

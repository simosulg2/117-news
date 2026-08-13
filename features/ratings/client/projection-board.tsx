import { RiigikoguSeatMap } from "@/components/riigikogu-seat-map";
import type { RatingsPoll } from "@/lib/ratings-types";

import type { RatingsViewModel } from "../model/ratings-view-model";
import { CoalitionLab } from "./coalition-lab";
import { GovernmentPanel } from "./government-panel";
import { PollInfo } from "./poll-info";

type ProjectionBoardProps = {
  poll: RatingsPoll;
  viewModel: RatingsViewModel;
  selectedPartyIds: ReadonlySet<string>;
  onToggleParty: (id: string) => void;
  onClearCoalition: () => void;
};

export function ProjectionBoard({
  poll,
  viewModel,
  selectedPartyIds,
  onToggleParty,
  onClearCoalition,
}: ProjectionBoardProps) {
  return (
    <section aria-labelledby="projection-heading" className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.72fr)]">
      <h2 id="projection-heading" className="sr-only">Riigikogu kohtade projektsioon</h2>
      <RiigikoguSeatMap
        parties={viewModel.chamberParties}
        selectedPartyIds={selectedPartyIds}
        selectedSeatCount={viewModel.selectedCoalitionSeats}
      />

      <div className="grid content-start gap-3">
        <GovernmentPanel
          governmentSeats={viewModel.governmentSeats}
          oppositionSeats={viewModel.oppositionSeats}
          eesti200Support={viewModel.eesti200Support}
        />
        <CoalitionLab
          parties={viewModel.hemicycleParties}
          selectedPartyIds={selectedPartyIds}
          selectedSeatCount={viewModel.selectedCoalitionSeats}
          selectedPartyCount={viewModel.selectedCoalitionCount}
          onToggleParty={onToggleParty}
          onClear={onClearCoalition}
        />
        <PollInfo poll={poll} thresholdWaste={viewModel.thresholdWaste} />
      </div>
    </section>
  );
}

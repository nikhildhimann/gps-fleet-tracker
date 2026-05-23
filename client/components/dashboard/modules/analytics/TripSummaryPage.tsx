import { TravelSummaryPage } from "./TravelSummaryPage"

export function TripSummaryPage(props: {
    organizations: any[]
    vehicles: any[]
    userRole: string | null
    userOrgId: string | null
}) {
    return <TravelSummaryPage mode="trip" {...props} />
}

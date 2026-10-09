import ManufacturerDash from '../components/ManufacturerDash.jsx'
import DistributorDash from '../components/DistributorDash.jsx'
import PharmacyDash from '../components/PharmacyDash.jsx'
import RegulatorDash from '../components/RegulatorDash.jsx'

export default function Dashboard({ actor }) {
  const dashMap = {
    manufacturer: ManufacturerDash,
    distributor: DistributorDash,
    pharmacy: PharmacyDash,
    regulator: RegulatorDash,
  };

  const DashComponent = dashMap[actor.role];

  if (!DashComponent) {
    return (
      <div className="container">
        <div className="banner banner-danger">Unknown role: {actor.role}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <DashComponent actor={actor} />
    </div>
  )
}

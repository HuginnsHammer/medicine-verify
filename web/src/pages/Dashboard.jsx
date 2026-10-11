import ManufacturerDash from '../components/ManufacturerDash.jsx'
import PharmacyDash from '../components/PharmacyDash.jsx'
import Distributor from './Distributor.jsx'
import Regulator from './Regulator.jsx'

/**
 * Legacy combined entry point. The Part C role views from this branch
 * (ManufacturerDash, PharmacyDash) are kept here; the distributor and
 * regulator views live in pages/Distributor.jsx and pages/Regulator.jsx and
 * take no props because they read the session from auth context.
 */
export default function Dashboard({ actor }) {
  if (actor.role === 'distributor') return <Distributor />;
  if (actor.role === 'regulator') return <Regulator />;

  const dashMap = {
    manufacturer: ManufacturerDash,
    pharmacy: PharmacyDash,
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

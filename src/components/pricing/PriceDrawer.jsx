import VehiclePriceCalculator from '../vehicle-detail/VehiclePriceCalculator.jsx';

/**
 * PriceDrawer – nutzt bestehenden Rechner (Bottom Sheet mobile, Panel desktop).
 */
export default function PriceDrawer(props) {
  return (
    <VehiclePriceCalculator
      embedded
      {...props}
      paymentView={props.paymentMode ?? props.paymentView}
      open={props.open}
      onOpenChange={props.onOpenChange}
      onApply={(draft) => {
        props.onApply?.({
          paymentMode: draft.paymentView,
          termMonths: draft.termMonths,
          mileagePerYear: draft.mileagePerYear,
          downPayment: draft.downPayment,
          financeDown: draft.financeDown,
          financeBalloon: draft.financeBalloon,
        });
      }}
    />
  );
}

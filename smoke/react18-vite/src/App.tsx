import { createRef, useState } from 'react';
import { DayPicker, type ButtonProps, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

const buttonRef = createRef<HTMLButtonElement>();
const buttonProps: ButtonProps = { ref: buttonRef, type: 'button' };
void buttonProps;

export default function App() {
  const [single, setSingle] = useState<Date>();
  const [range, setRange] = useState<DateRange>();

  return (
    <main>
      <DayPicker mode="single" selected={single} onSelect={setSingle} />
      <DayPicker mode="range" selected={range} onSelect={setRange} />
    </main>
  );
}

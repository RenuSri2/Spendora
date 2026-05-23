'use client';

import dynamic from 'next/dynamic';

const MoneyMascot = dynamic(
  () => import('./MoneyMascot'),
  { ssr: false }
);

export default function MascotWrapper() {
  return <MoneyMascot />;
}

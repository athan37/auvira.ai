import { redirect } from 'next/navigation';

/** Site entry — always open the intro landing page. */
export default function Home() {
  redirect('/intro');
}

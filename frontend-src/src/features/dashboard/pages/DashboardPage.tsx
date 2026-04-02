import { useState } from 'react';
import TopBar from '../components/TopBar';
import WelcomeBanner from '../components/WelcomeBanner';
import ReadingSection from '../components/ReadingSection';
import StreakCard from '../components/StreakCard';

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div>
      <TopBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <WelcomeBanner />
          <ReadingSection searchTerm={searchTerm} onSearchClear={() => setSearchTerm('')} />
        </div>
        <div className="w-full xl:w-[320px] flex xl:block justify-end">
          <StreakCard />
        </div>
      </div>
    </div>
  );
}

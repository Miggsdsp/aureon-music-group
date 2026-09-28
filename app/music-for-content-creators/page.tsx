import { CreatorLicensingPage } from '@/components/CreatorLicensingPage';
import { creatorLicensingMetadata, getCreatorLicensingPage } from '@/lib/creator-licensing-pages';

export const revalidate = 300;
export const metadata = creatorLicensingMetadata('music-for-content-creators');

export default function Page() {
  return <CreatorLicensingPage page={getCreatorLicensingPage('music-for-content-creators')!} />;
}

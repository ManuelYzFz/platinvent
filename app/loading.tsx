import Preloader from '@/components/layout/Preloader';

export default function Loading() {
  return <Preloader fullScreen={true} message="Cargando información..." />;
}

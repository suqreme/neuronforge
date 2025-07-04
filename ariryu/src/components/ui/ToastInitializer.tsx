import { useEffect } from 'react';
import { useToast } from './Toast';
import { setToastFunction } from '../../utils/fileWriter';

const ToastInitializer: React.FC = () => {
  const { addToast } = useToast();

  useEffect(() => {
    // Set the toast function for file writer
    setToastFunction((message, type) => {
      addToast({ message, type });
    });
  }, [addToast]);

  return null; // This component doesn't render anything
};

export default ToastInitializer;
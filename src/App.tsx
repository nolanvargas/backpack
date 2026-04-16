import { useMonitor } from './hooks/useMonitor';
import CapturePanel from './components/CapturePanel';
import ItemsPanel   from './components/ItemsPanel';
import StatsPanel   from './components/StatsPanel';
import EventLog     from './components/EventLog';

export default function App() {
  const monitor = useMonitor();

  return (
    <>
      <header>
        <div className="logo">
          <span>BACKPACK</span>
        </div>
      </header>

      <main>
        <CapturePanel
          videoRef={monitor.videoRef}
          hiddenCanvasRef={monitor.hiddenCanvasRef}
          overlayCanvasRef={monitor.overlayCanvasRef}
          captureActive={monitor.captureActive}
          badge={monitor.badge}
          sessionStart={monitor.sessionStart}
          ocrStatus={monitor.ocrStatus}
          lastScanTime={monitor.lastScanTime}
          confidence={monitor.confidence}
          scanCount={monitor.scanCount}
          lastBlue={monitor.lastBlue}
          roi={monitor.roi}
          autoOcr={monitor.autoOcr}
          setROI={monitor.setROI}
          setAutoOcr={monitor.setAutoOcr}
          startCapture={monitor.startCapture}
          stopCapture={monitor.stopCapture}
          clearData={monitor.clearData}
        />

        <ItemsPanel
          items={monitor.items}
          addOrUpdateItem={monitor.addOrUpdateItem}
          removeItem={monitor.removeItem}
        />

        <StatsPanel
          items={monitor.items}
          scanCount={monitor.scanCount}
          detectionCount={monitor.detectionCount}
          activityHistory={monitor.activityHistory}
        />
      </main>

      <EventLog logs={monitor.logs} />
    </>
  );
}

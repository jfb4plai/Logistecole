import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { extraireCodeDepuisTexte } from '../domain/codes.js';
import ChampGuide from '../components/ChampGuide.jsx';

export default function Scan() {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const [message, setMessage] = useState('Pointez la caméra vers le QR code de l\'étiquette.');
  const [alerte, setAlerte] = useState(false);
  const [camera, setCamera] = useState('demarrage'); // demarrage | ok | indisponible
  const [saisie, setSaisie] = useState('');

  useEffect(() => {
    let dernier = '';
    let dernierTemps = 0;
    const scanner = new QrScanner(
      videoRef.current,
      (res) => {
        const texte = res.data;
        const maintenant = Date.now();
        if (texte === dernier && maintenant - dernierTemps < 2000) return; // évite le clignotement du message
        dernier = texte;
        dernierTemps = maintenant;
        const code = extraireCodeDepuisTexte(texte);
        if (code) {
          scanner.stop();
          navigate(`/o/${code}`);
        } else {
          setAlerte(true);
          setMessage('Ce QR code n\'est pas une étiquette Logistécole. Essayez une autre étiquette ou saisissez le code ci-dessous.');
        }
      },
      { preferredCamera: 'environment', highlightScanRegion: true, returnDetailedScanResult: true },
    );
    scanner.start().then(() => setCamera('ok')).catch(() => setCamera('indisponible'));
    return () => scanner.destroy();
  }, [navigate]);

  function ouvrir(e) {
    e.preventDefault();
    const code = extraireCodeDepuisTexte(saisie);
    if (!code) {
      setAlerte(true);
      setMessage('Ce code n\'est pas valide. Il compte 8 caractères (lettres et chiffres), par exemple ABCD-2345.');
      return;
    }
    navigate(`/o/${code}`);
  }

  return (
    <>
      <h1>Scanner une étiquette</h1>
      {camera === 'indisponible' ? (
        <p className="plai-error" role="alert">La caméra est indisponible ou refusée. Autorisez-la dans votre navigateur, ou saisissez le code inscrit sur l'étiquette.</p>
      ) : (
        <>
          <video ref={videoRef} className="scan-video" muted playsInline />
          <p className={alerte ? 'plai-error' : 'accroche'} role="status">{message}</p>
        </>
      )}
      {camera === 'indisponible' && <video ref={videoRef} hidden />}
      <form className="plai-card scan-manuel" onSubmit={ouvrir}>
        <ChampGuide id="code" label="Ou saisissez le code de l'étiquette" aide="Le code est imprimé sous le QR, sous la forme ABCD-2345. Majuscules ou minuscules, avec ou sans tiret.">
          <input id="code" aria-describedby="code-aide" className="plai-input" placeholder="Ex. : ABCD-2345" autoCapitalize="characters" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </ChampGuide>
        <button className="plai-btn">Ouvrir la fiche</button>
      </form>
    </>
  );
}

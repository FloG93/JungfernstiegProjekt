import { render } from 'preact';

function App() {
  return <p>Lade …</p>;
}

const root = document.getElementById('app');
if (root) render(<App />, root);

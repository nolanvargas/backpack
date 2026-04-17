import '@mantine/core/styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

ReactDOM.createRoot(rootEl).render(
	<React.StrictMode>
		<MantineProvider>
			<App />
		</MantineProvider>
	</React.StrictMode>,
);

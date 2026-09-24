export interface UpdateItem {
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix' | 'security';
  icon?: string;
}

export interface SystemRelease {
  id: string;
  version: string;
  date: string;
  title: string;
  summary: string;
  items: UpdateItem[];
}

/**
 * Registro de versões e atualizações do sistema Rodochagas Logística.
 * Sempre que subir uma nova atualização ou melhoria, adicione o registro no topo da lista.
 */
export const SYSTEM_RELEASES: SystemRelease[] = [
  {
    id: 'rel_2026_09_23_v2_8_4',
    version: 'v2.8.4',
    date: '23/09/2026',
    title: 'Gestão Avançada de Embarques, Tabela Interativa e Anexos',
    summary: 'Nova tabela unificada de embarques com filtros multicritério, modal dedicado para comprovantes e anexos, flexibilidade em adiantamentos e relatórios de embarcadores.',
    items: [
      {
        category: 'feature',
        title: 'Tabela Completa de Embarques (ShipmentTable)',
        description: 'Visualização abrangente de todos os embarques com filtros por status, pesquisa instantânea, ordenação personalizada e acesso rápido aos detalhes operacionais.'
      },
      {
        category: 'feature',
        title: 'Gestão de Anexos e Comprovantes (AttachmentModal)',
        description: 'Novo modal para upload, conferência e download de comprovantes de pagamento e documentos de transporte diretamente nos registros de embarque.'
      },
      {
        category: 'improvement',
        title: 'Flexibilidade de Adiantamento e Reversão de Status',
        description: 'Suporte a adiantamento com 0% e transição contínua entre etapas, além de reversão segura de status no dashboard e na tabela.'
      },
      {
        category: 'improvement',
        title: 'Ranking de Embarcadores e Relatórios Analíticos',
        description: 'Cálculos unificados de faturamento e volume de cargas por cliente embarcador nos relatórios e nos painéis do dashboard.'
      },
      {
        category: 'improvement',
        title: 'Otimização de Desempenho e Bundle Splitting',
        description: 'Divisão otimizada de pacotes no Vite para carregamento ultrarrápido dos módulos e painéis de embarque.'
      }
    ]
  },
  {
    id: 'rel_2026_09_21_v2_8_3',
    version: 'v2.8.3',
    date: '21/09/2026',
    title: 'Instalação PWA, Download do App e Acesso Offline',
    summary: 'Aprimoramento do fluxo de instalação do aplicativo Web/PWA, correção no direcionamento de download e implementação de Service Worker com Workbox.',
    items: [
      {
        category: 'fix',
        title: 'Correção de 404 e Fluxo de Instalação do App',
        description: 'Ajuste nas rotas e redirecionamentos da página de download do aplicativo para dispositivos móveis (Android/iOS) e desktop.'
      },
      {
        category: 'feature',
        title: 'Service Worker com Precaching Workbox',
        description: 'Estratégia avançada de cache e roteamento para permitir carregamento instantâneo e estabilidade em conexões móveis.'
      }
    ]
  },
  {
    id: 'rel_2026_09_19_v2_8_2',
    version: 'v2.8.2',
    date: '19/09/2026',
    title: 'Estabilidade Mobile: Correção de Recarregamento e Gestos no Celular',
    summary: 'Correção crítica para aparelhos celulares que impedia o preenchimento de cadastros de cargas e solicitações de embarque devido a recarregamentos automáticos e gestos de rolagem nativos.',
    items: [
      {
        category: 'fix',
        title: 'Bloqueio do Gesto Pull-to-Refresh & Overscroll',
        description: 'Implementado isolamento de rolagem elástica em todos os modais e na aplicação móvel, eliminando recarregamentos acidentais ao rolar o topo ou rodapé de formulários.'
      },
      {
        category: 'fix',
        title: 'Proteção de Teclado e Submissão Mobile',
        description: 'Tratamento das teclas "Enter" e "Ir" dos teclados virtuais para impedir envios prematuros ou reset de assistentes de cadastro de cargas e ordens.'
      },
      {
        category: 'improvement',
        title: 'Segurança de Sessão e Prevenção de Perda de Dados',
        description: 'Adicionada confirmação antes de descarregar a página enquanto modais de cadastro estiverem abertos e proteção contra cliques duplos em conexões móveis.'
      }
    ]
  },
  {
    id: 'rel_2026_09_15_v2_8_0',
    version: 'v2.8.0',
    date: '15/09/2026',
    title: 'Gestão Avançada de Cargas, Histórico de Viagens e Rotas',
    summary: 'Novas ferramentas de visualização geográfica de fretes, histórico operacional de motoristas e painel de controle com a identidade visual da Rodochagas.',
    items: [
      {
        category: 'feature',
        title: 'Mapa Operacional Inteligente',
        description: 'Visualização interativa das origens, destinos e concentração de cargas disponíveis com filtros por proximidade.'
      },
      {
        category: 'feature',
        title: 'Painel de Embarques e Auditoria',
        description: 'Rastreamento completo do status de ordens, geração de comprovantes em PDF e histórico com registros de horários.'
      },
      {
        category: 'improvement',
        title: 'Nova Identidade Visual Rodochagas',
        description: 'Interface redesenhada com a paleta oficial em Azul Profundo e Laranja Vibrante, com suporte otimizado a Modo Escuro e Claro.'
      }
    ]
  },
  {
    id: 'rel_2026_09_01_v2_7_0',
    version: 'v2.7.0',
    date: '01/09/2026',
    title: 'Cálculo de Estadias e Cotações Rápidas de Frete',
    summary: 'Lançamento das ferramentas de cálculo de estadia de veículos conforme legislação ANTT e módulo de cotação instantânea de fretes.',
    items: [
      {
        category: 'feature',
        title: 'Calculadora de Estadias e Paradas',
        description: 'Cálculo automatizado do valor de diárias e atrasos de descarga com emissão de relatórios detalhados.'
      },
      {
        category: 'feature',
        title: 'Histórico de Ferramentas e Ofertas',
        description: 'Centralização de todas as simulações, ofertas convertidas e cotações realizadas pela equipe comercial.'
      },
      {
        category: 'security',
        title: 'Conformidade e Regras de Bloqueio ANTT',
        description: 'Validação preventiva de motoristas com restrições e verificação de titularidade de cadastro.'
      }
    ]
  }
];

export const LATEST_SYSTEM_RELEASE = SYSTEM_RELEASES[0];

const STORAGE_PREFIX = 'rodochagas_seen_update_';

/**
 * Verifica se o modal de novidades deve ser exibido para o usuário.
 * Retorna true apenas no primeiro acesso após uma nova atualização.
 */
export const shouldShowUpdateModal = (userId?: string): boolean => {
  if (!userId) return false;
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const lastSeenId = localStorage.getItem(key);
    return lastSeenId !== LATEST_SYSTEM_RELEASE.id;
  } catch {
    return false;
  }
};

/**
 * Marca a versão atual como visualizada pelo usuário para não reabrir automaticamente.
 */
export const markUpdateAsSeen = (userId?: string, releaseId: string = LATEST_SYSTEM_RELEASE.id): void => {
  if (!userId) return;
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    localStorage.setItem(key, releaseId);
  } catch (err) {
    console.warn('Erro ao salvar status de visualização de atualização:', err);
  }
};

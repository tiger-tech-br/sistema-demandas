# Entrega Android — Sistema de Demandas

O aplicativo mantém o identificador `com.viviani.sistemademandas`. A entrega atual usa versão **1.7**, `versionCode` **9**, build `release` sem depuração e a mesma chave de produção das versões anteriores. O Gradle não usa a chave de debug para assinar releases.

## Assinatura e atualização

A chave privada está em `android/keystore/tiger-tech-release.jks`. As credenciais ficam em `android/keystore/keystore.properties`. Todo o diretório é ignorado pelo Git; as senhas não fazem parte do código nem do APK.

**Preserve uma cópia de segurança cifrada desses dois arquivos fora deste computador.** Eles são necessários para assinar atualizações que possam ser instaladas sobre esta versão. Não substitua a chave em futuras compilações. O alias público desta chave é `tiger-tech-release`. Certificado de produção SHA-256: `92:2E:F4:3C:F4:85:2E:D7:15:9C:72:A5:AD:7E:D0:2A:F9:24:98:35:BC:3D:72:1F:42:EC:10:25:B1:CC:DF:82`.

A versão de teste anterior à 1.4 foi assinada com um certificado de debug diferente. Somente quem ainda usa essa versão antiga precisa desinstalá-la antes de instalar um release de produção, o que limpa sessões, cache, permissões e notificações locais. Os dados da conta armazenados no servidor/Neon permanecem disponíveis após entrar novamente. Permita notificações na nova instalação para receber os avisos do aplicativo. Quem já usa a 1.4, 1.4.1, 1.5 ou 1.6 de produção pode instalar `SistemaDemandas-v1.7.apk` por cima, sem desinstalar.

A nova chave passa a permitir atualizações diretas das próximas versões assinadas com ela. A publicação em loja não foi realizada nesta entrega.

## Compilação

Ferramentas usadas: JDK 21 do Android Studio (`C:\Program Files\Android\Android Studio\jbr`), SDK Android local e Gradle 8.14.3 já armazenado em cache. A versão 1.7 foi compilada diretamente com esse binário, sem alterar o wrapper atual, que aponta para 9.7.1. O build 8.14.3 informa recursos incompatíveis com Gradle 9; não substitua o comando abaixo pelo wrapper sem revisar essa compatibilidade. O aplicativo requer Android 7.0/API 24 ou superior e tem alvo Android API 36.

Na raiz do projeto, compile primeiro a interface e sincronize os recursos:

```powershell
npm run build
npx cap sync android
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_SDK_ROOT = 'C:\Users\andre\AppData\Local\Android\Sdk'
$env:GRADLE_USER_HOME = 'C:\Users\andre\.gradle'
Push-Location android
$gradleAndroid = 'C:\Users\andre\.gradle\wrapper\dists\gradle-8.14.3-all\10utluxaxniiv4wxiphsi49nj\gradle-8.14.3\bin\gradle.bat'
& $gradleAndroid :app:assembleRelease --offline
Pop-Location
Copy-Item android\app\build\outputs\apk\release\app-release.apk SistemaDemandas-v1.7.apk
```

O modo `--offline` depende de um cache Gradle já preenchido. Para uso em outro computador, instale o SDK, restaure a mesma chave e credenciais e configure `android/local.properties`. A configuração privada segue este formato, com os valores reais inseridos apenas no arquivo ignorado:

```properties
storeFile=keystore/tiger-tech-release.jks
storePassword=<senha-do-armazenamento>
keyAlias=tiger-tech-release
keyPassword=<senha-da-chave>
```

O projeto também abre diretamente na pasta `android` no Android Studio. Use o build variant `release`. O Gradle sincroniza `web/dist` com os assets, removendo arquivos web antigos; compile a interface antes de gerar qualquer nova versão.

## Configuração desta entrega

- Backend nativo de notificações usa HTTPS no domínio de produção Railway.
- Capacitor serve a interface embarcada em `https://localhost`; tráfego HTTP sem criptografia está bloqueado no manifesto e na política de rede.
- Backup Android está desativado para evitar restauração/cópia automática dos dados de sessão locais.
- Temas de inicialização, barra de status, navegação e WebView preservam o fundo branco.

## Verificação do artefato

A entrega deve ser verificada com `apksigner verify --verbose --print-certs`, `aapt dump badging` e inspeção do manifesto binário. Compare também os hashes dos arquivos em `assets/public/` no APK com a pasta `web/dist` da compilação final. O APK não deve conter credenciais de assinatura nem URLs antigas de infraestrutura.

Os dados finais do artefato (hash, tamanho, certificado e resultado das verificações) são registrados abaixo após a compilação. Não há dispositivo conectado, AVD configurado nem imagem Android instalada no SDK deste ambiente. Portanto, o APK ainda não foi executado em Android real ou emulador. Instalação, início do aplicativo, permissões, retorno do segundo plano e notificações precisam de validação em dispositivo antes de divulgação comercial como aplicativo testado.
## Artefato final validado — 1 de novembro de 2026

- Arquivo de entrega: `SistemaDemandas-v1.4.apk` na raiz do projeto.
- Pacote: `com.viviani.sistemademandas`; versão `1.4`; `versionCode` `5`; mínimo API `24`; alvo API `36`.
- Tamanho: **13.266.288 bytes** (aproximadamente **12,65 MiB**).
- SHA-256 do APK: `82F40C8EAB76BD97672A99D6506EA61AF5AF9176176F2A8F1DEB79D3C152F0E5`.
- Certificado de produção SHA-256: `92:2E:F4:3C:F4:85:2E:D7:15:9C:72:A5:AD:7E:D0:2A:F9:24:98:35:BC:3D:72:1F:42:EC:10:25:B1:CC:DF:82`.

A compilação `:app:assembleRelease` concluiu com sucesso usando o JDK do Android Studio. A primeira tentativa offline identificou bibliotecas de lint ausentes no cache; a compilação final obteve essas dependências dos repositórios configurados e manteve o lint habilitado.

Verificações concluídas: assinatura válida por `apksigner`; alinhamento válido por `zipalign`; pacote e versão corretos; release sem depuração; backup desativado; HTTP bloqueado no manifesto e no recurso de política de rede efetivamente referenciado pelo APK. O otimizador renomeou o XML da política para `res/8G.xml`, resolvido pela tabela de recursos a partir do ID `0x7f110002` no manifesto.

Os **8 arquivos web** embarcados correspondem exatamente aos hashes de `web/dist` final, incluindo `assets/index-BycGpBIA.js` e `assets/index-C_1m6_FZ.css`. A inspeção não encontrou assets web extras, URLs antigas Render, arquivos privados de assinatura ou senhas de assinatura no APK. A cópia na raiz foi conferida novamente por SHA-256.

**Limite de validação:** não houve execução do APK em aparelho físico ou emulador. Instalação, início, login, permissões e notificações no Android continuam pendentes de teste em dispositivo. A aprovação estática e a compilação não substituem esses testes.

## Atualização 1.4.1 — 1 de novembro de 2026

Centraliza o texto **Entrar** no botão de login. Arquivo: `SistemaDemandas-v1.4.1.apk`; versão `1.4.1`; `versionCode` `6`; tamanho **13.266.304 bytes**. SHA-256: `19DCA9405B0BE2854B0D132A4020B051A7C8FB0C27B829C4201086154302EFBB`.

Assinada com a mesma chave de produção da 1.4, permite atualizar sobre a **1.4 de produção sem desinstalar**, preservando os dados locais. A orientação anterior de desinstalação aplica-se às versões antigas assinadas com a chave de debug.

Build com Gradle 8.14.3 e verificação final concluídos: assinatura, pacote/versão, release sem depuração, alinhamento, backup e HTTP desativados. Os 8 assets correspondem exatamente ao `web/dist` final, incluindo `assets/index-DMsEP6Ik.js` e `assets/index-DL5U2vGb.css`; sem arquivos web extras, URLs antigas ou credenciais de assinatura. A cópia final foi conferida por SHA-256.

O teste em aparelho físico ou emulador continua pendente.

## Atualização 1.5 — 1 de novembro de 2026

Inclui lixeira para demandas, exclusão individual, **Selecionar todas → Excluir tudo**, fontes maiores e ajustes de espaçamento e apresentação no celular. Arquivo: `SistemaDemandas-v1.5.apk`; versão `1.5`; `versionCode` `7`; tamanho **13.270.920 bytes**. SHA-256: `2D5A2E321D07A97F7B20A523D9054D82C335A0DE7A6C41AD05E603867119DA53`.

Usa a mesma chave de produção das versões 1.4 e 1.4.1 e permite atualizar sobre essas versões sem desinstalar, preservando os dados locais. Os APKs anteriores permanecem disponíveis.

Compilação com Gradle 8.14.3 e verificação final concluídas: assinatura, pacote/versão, release sem depuração, alinhamento e bloqueio de backup e HTTP. Os 8 assets correspondem ao `web/dist` final, incluindo `assets/index-CQMr5ME8.js` e `assets/index-Q5nb2I0L.css`; sem arquivos web extras, URLs antigas ou credenciais de assinatura. A cópia final foi conferida novamente por SHA-256.

Os **30 testes automatizados** passaram. O QA da interface no Chrome passou nos tamanhos de 320, 390 e 1366 px, incluindo os fluxos da lixeira, seleção em lote e geometria das ações. Esses testes de navegador não executam o APK: o teste de execução da versão 1.5 em aparelho Android físico ou emulador Android continua pendente.

## Atualização 1.6 — 3 de novembro de 2026

Inclui **Excluir cadastro** em Minha conta e Privacidade, com confirmação em modal, exclusão definitiva dos dados da própria conta e encerramento das sessões. Acrescenta os atalhos de assinatura e privacidade em Minha conta e permite pedir cancelamento de assinatura mesmo com acesso profissional bloqueado. A exclusão local não cancela a recorrência no PagBank, conforme informado no modal.

- Arquivo: `SistemaDemandas-v1.6.apk`, na raiz do projeto.
- Pacote: `com.viviani.sistemademandas`; versão `1.6`; `versionCode` `8`; mínimo API `24`; alvo API `36`.
- Tamanho: **13.271.908 bytes** (aproximadamente **12,66 MiB**).
- SHA-256: `E50311EDDFB955FC0CE5FC0A29CD4432E9D72E3033B9F8A863445CB566CD617D`.
- Certificado SHA-256: `92:2E:F4:3C:F4:85:2E:D7:15:9C:72:A5:AD:7E:D0:2A:F9:24:98:35:BC:3D:72:1F:42:EC:10:25:B1:CC:DF:82`, conferido novamente contra o APK 1.5. Permite atualização por cima das versões de produção anteriores.

`npm run android:sync` e `:app:assembleRelease --offline` concluíram com sucesso, com lint habilitado, Gradle 8.14.3 e JDK do Android Studio. `apksigner` confirmou assinatura válida pelo esquema v2; `zipalign` aprovou o alinhamento. A inspeção com `aapt` confirmou pacote, versão, APIs, release sem depuração, backup desativado e tráfego HTTP bloqueado. A política de rede empacotada em `res/8G.xml`, referenciada pelo manifesto, também bloqueia HTTP.

Os **8 arquivos web** do APK correspondem por SHA-256 ao `web/dist` atual, sem arquivos extras, incluindo `assets/index-DnY7ixlX.js` e `assets/index-WTZ9GHAS.css`. O domínio de produção foi publicado a partir do commit `2d87f4fe6515fcafd01fa9229b9dc24f56180253` e os assets remotos conferidos correspondem ao mesmo build. A cópia final do APK tem o mesmo hash do artefato assinado gerado pelo Gradle. Não foram encontrados arquivos `.env`, keystore ou URLs antigas Render no pacote web.

Os **34 testes automatizados** da aplicação passaram em PostgreSQL temporário, incluindo exclusão definitiva, isolamento e reversão integral em caso de falha. **Não houve execução deste APK em aparelho físico ou emulador**; instalação e os fluxos nativos, inclusive permissões e notificações, continuam pendentes de validação em dispositivo.

## Atualização 1.7 — 3 de novembro de 2026

Vincula a exclusão do cadastro ao encerramento da cobrança. Com assinatura ainda sem cancelamento confirmado ou checkout iniciado no aplicativo ainda em conferência, a exclusão fica pendente e mantém a conta e as sessões. O administrador encerra a cobrança no PagBank ou confere que a contratação não gerou recorrência e confirma no painel; a conta é apagada automaticamente na mesma transação. Sem cobrança a encerrar, a exclusão permanece imediata. A interface apresenta a espera e consulta a sessão periodicamente para encerrar a tela após a exclusão.

- Arquivo: `SistemaDemandas-v1.7.apk`; tamanho **13.273.132 bytes**.
- Pacote: `com.viviani.sistemademandas`; versão `1.7`; `versionCode` `9`; mínimo API `24`; alvo API `36`.
- SHA-256: `4E8F6400A2AAA0FDA12B95210BEC48700157335035FF8B46804FEE8D6278B58F`.
- Certificado SHA-256: `92:2E:F4:3C:F4:85:2E:D7:15:9C:72:A5:AD:7E:D0:2A:F9:24:98:35:BC:3D:72:1F:42:EC:10:25:B1:CC:DF:82`, igual às versões de produção anteriores.

Sincronização Capacitor e `:app:assembleRelease --offline` concluídas com Gradle 8.14.3, JDK do Android Studio e lint habilitado. Assinatura v2, alinhamento, versão, pacote, release sem depuração e bloqueios de backup e HTTP foram conferidos. A política `res/8G.xml`, referenciada pelo manifesto como `0x7f110002`, também bloqueia HTTP.

Os oito assets embarcados correspondem por SHA-256 ao build local, incluindo `assets/index-DWR0TkqB.js` e `assets/index-D3D7gpCJ.css`, sem arquivos extras nem `.env` ou arquivos de assinatura no pacote. Fonte da compilação: commit `e784a920a655a3b688e4ff8f03e46f8c01924f4f`.

Os **39 testes** passaram em PostgreSQL temporário. O cancelamento no PagBank continua manual e precisa ser conferido pelo responsável; o aplicativo não simula uma integração automática. Contratações anteriores ao rastreamento ou por links externos ainda exigem identificação manual. **Execução em aparelho físico ou emulador permanece pendente.**

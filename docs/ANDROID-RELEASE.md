# Entrega Android — Sistema de Demandas

O aplicativo mantém o identificador `com.viviani.sistemademandas`. Esta entrega usa versão **1.4**, `versionCode` **5**, build `release` sem depuração e uma chave de produção própria. O Gradle não usa a chave de debug para assinar releases.

## Assinatura e atualização

A chave privada está em `android/keystore/tiger-tech-release.jks`. As credenciais ficam em `android/keystore/keystore.properties`. Todo o diretório é ignorado pelo Git; as senhas não fazem parte do código nem do APK.

**Preserve uma cópia de segurança cifrada desses dois arquivos fora deste computador.** Eles são necessários para assinar atualizações que possam ser instaladas sobre esta versão. Não substitua a chave em futuras compilações. O alias público desta chave é `tiger-tech-release`. Certificado de produção SHA-256: `92:2E:F4:3C:F4:85:2E:D7:15:9C:72:A5:AD:7E:D0:2A:F9:24:98:35:BC:3D:72:1F:42:EC:10:25:B1:CC:DF:82`.

A versão de teste anterior foi assinada com um certificado de debug diferente. Para instalar este release, desinstale primeiro o aplicativo anterior e depois instale `SistemaDemandas-v1.4.apk`. Isso limpa sessões, cache, permissões e notificações locais. Os dados da conta armazenados no servidor/Neon permanecem disponíveis após entrar novamente. Permita notificações na nova instalação para receber os avisos do aplicativo.

A nova chave passa a permitir atualizações diretas das próximas versões assinadas com ela. A publicação em loja não foi realizada nesta entrega.

## Compilação

Ferramentas usadas: JDK 21 do Android Studio (`C:\Program Files\Android\Android Studio\jbr`), SDK Android local e Gradle 8.14.3. O wrapper aponta para a distribuição `8.14.3-all` já armazenada em cache. O aplicativo requer Android 7.0/API 24 ou superior e tem alvo Android API 36.

Na raiz do projeto, compile primeiro a interface e sincronize os recursos:

```powershell
npm run build
npx cap sync android
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_SDK_ROOT = 'C:\Users\andre\AppData\Local\Android\Sdk'
$env:GRADLE_USER_HOME = 'C:\Users\andre\.gradle'
Push-Location android
.\gradlew.bat :app:assembleRelease --offline
Pop-Location
Copy-Item android\app\build\outputs\apk\release\app-release.apk SistemaDemandas-v1.4.apk
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

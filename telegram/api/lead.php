<?php
/**
 * Telegram Mini App -> verified Google Sheets Apps Script.
 * Set ASPECKOR_BOT_TOKEN in private server environment.
 * Never publish Telegram bot credentials in GitHub or public webroot.
 * Existing VK app and Apps Script are deliberately unchanged.
 */
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function reply(int $status, bool $ok, string $code): never {
    http_response_code($status);
    echo json_encode(['ok'=>$ok,'code'=>$code],JSON_UNESCAPED_UNICODE);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405,false,'METHOD_NOT_ALLOWED');
if (stripos((string)($_SERVER['CONTENT_TYPE']??''),'application/json') !== 0) reply(415,false,'JSON_REQUIRED');
if ((int)($_SERVER['CONTENT_LENGTH']??0) > 24000) reply(413,false,'PAYLOAD_TOO_LARGE');
$raw=file_get_contents('php://input',false,null,0,24001);
if(!is_string($raw) || strlen($raw)>24000) reply(400,false,'INVALID_BODY');
$data=json_decode($raw,true);
if(!is_array($data)) reply(400,false,'INVALID_JSON');
$botToken=(string)(getenv('ASPECKOR_BOT_TOKEN') ?: '');
if($botToken === '') {
    // Beget shared hosting: read secret from a PHP file OUTSIDE web document root.
    // E.g. <site>/aspeckor-secrets.php, next to <site>/public_html/.
    $documentRoot=realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if($documentRoot!==false && is_dir($documentRoot)) {
        $privateConfig=dirname($documentRoot).'/aspeckor-secrets.php';
        if(is_file($privateConfig) && is_readable($privateConfig)) {
            $privateSettings=require $privateConfig;
            if(is_array($privateSettings)) {
                $botToken=(string)($privateSettings['ASPECKOR_BOT_TOKEN'] ?? '');
            }
        }
    }
}
if(!preg_match('/^[0-9]{5,16}:[A-Za-z0-9_-]{20,}$/D',$botToken)) {
    reply(503,false,'SERVER_NOT_CONFIGURED');
}
$init=$data['initData']??null;
if(!is_string($init) || strlen($init)>8192 || $init==='') reply(401,false,'TELEGRAM_AUTH_REQUIRED');
$params=[];
foreach(explode('&',$init) as $kv) {
    $pair=explode('=',$kv,2);
    $key=urldecode($pair[0]);
    $value=urldecode($pair[1]??'');
    if(!preg_match('/^[a-z_]{1,64}$/D',$key) || array_key_exists($key,$params)) reply(401,false,'INVALID_INIT_DATA');
    $params[$key]=$value;
}
$hash=$params['hash']??'';
if(!is_string($hash) || !preg_match('/^[0-9a-f]{64}$/D',$hash)) reply(401,false,'INVALID_SIGNATURE');
unset($params['hash']);
ksort($params,SORT_STRING);
$parts=[];
foreach($params as $key=>$value) $parts[]=$key.'='.$value;
$secret=hash_hmac('sha256',$botToken,'WebAppData',true);
$expected=hash_hmac('sha256',implode("\n",$parts),$secret);
if(!hash_equals($expected,$hash)) reply(401,false,'INVALID_SIGNATURE');
$authDate=$params['auth_date']??'';
if(!ctype_digit($authDate) || (int)$authDate < time()-86400 || (int)$authDate > time()+60) {
    reply(401,false,'SESSION_EXPIRED');
}
$user=json_decode($params['user']??'',true);
$userId=$user['id']??null;
if(!is_array($user) || !is_int($userId) || $userId <= 0) reply(401,false,'INVALID_TELEGRAM_USER');

$name=trim((string)($data['name']??''));
$city=trim((string)($data['city']??''));
$phone=preg_replace('/\D+/','',(string)($data['phone']??''));
$teams=filter_var($data['teams']??null,FILTER_VALIDATE_INT);
$current=filter_var($data['currentOrders']??null,FILTER_VALIDATE_INT);
$localTime=(string)($data['callTime']??'');
$tz=(string)($data['timeZone']??'Europe/Moscow');
if(($data['consent']??null)!==true ||
   $name==='' || strlen($name)>160 ||
   $city==='' || strlen($city)>160 ||
   !is_string($phone) || !preg_match('/^7[0-9]{10}$/D',$phone) ||
   $teams===false || $teams<1 || $teams>5 ||
   $current===false || $current<0 || $current>300 ||
   !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/D',$localTime) ||
   !in_array($tz,DateTimeZone::listIdentifiers(),true)) {
    reply(422,false,'INVALID_LEAD_DATA');
}
$timeObj=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i',$localTime,new DateTimeZone($tz));
if(!$timeObj || $timeObj->format('Y-m-d\TH:i')!==$localTime ||
   $timeObj->getTimestamp()<time()-60 ||
   $timeObj->getTimestamp()>time()+86400*60) reply(422,false,'INVALID_CALL_TIME');

$map=['yt'=>'YouTube','ig'=>'Instagram','tg'=>'Telegram'];
$start=$params['start_param']??'';
$source=$map[$start]??'Telegram / прямой переход';
$targets=[1=>24,2=>44,3=>67,4=>83];
$target=$targets[$teams]??null;
$gap=$target===null?null:max(0,$target-$current);
// The Google Apps Script URL is the same endpoint used by the VK Mini App.
// The sheet and its existing doPost(e) remain unchanged.
$appsScriptUrl='https://script.google.com/macros/s/AKfycbzJ0Jl_7sx_Dtp6Aana2vHrhoC0VTj5Jtod4o3Mz-nkHW7DYguFScr27H4OenUdJ5mtNA/exec';
$campaign=in_array($start,['yt','ig','tg'],true) ? $start : '';
$entryUrl=$campaign!=='' ? 'https://t.me/Aspeckor_bot?startapp='.$campaign : 'https://t.me/Aspeckor_bot';
$entryParams=json_encode([
    'start_param'=>$campaign,
    'telegramUserId'=>(string)$userId
],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
$requiredMeasures=$target===null ? '' : (string)ceil($target/0.70);
$requiredLeads=$target===null ? '' : (string)ceil(ceil($target/0.70)/0.33);

$lead=[
    'name'=>$name,
    'phone'=>'+'.$phone,
    'city'=>$city,
    'teams'=>$teams===5?'5+':(string)$teams,
    // Strings preserve "0" in the existing Apps Script's "|| ''" expressions.
    'currentOrders'=>(string)$current,
    'targetOrders'=>$target===null?'':(string)$target,
    'orderGap'=>$gap===null?'':(string)$gap,
    'requiredMeasures'=>$requiredMeasures,
    'requiredLeads'=>$requiredLeads,
    'callTime'=>$localTime.' ('.$tz.')',
    'source'=>$source,
    'campaign'=>$campaign,
    'ad'=>'',
    'entryParams'=>$entryParams,
    'entryUrl'=>$entryUrl
];
$body=json_encode($lead,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
if(!is_string($body))reply(500,false,'ENCODING_ERROR');
if(!function_exists('curl_init'))reply(503,false,'CURL_UNAVAILABLE');

$ch=curl_init($appsScriptUrl);
if($ch===false)reply(503,false,'CURL_UNAVAILABLE');
curl_setopt_array($ch,[
    CURLOPT_POST=>true,
    CURLOPT_POSTFIELDS=>$body,
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_CONNECTTIMEOUT=>8,
    CURLOPT_TIMEOUT=>25,
    CURLOPT_FOLLOWLOCATION=>true,
    CURLOPT_MAXREDIRS=>3,
    CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
    CURLOPT_REDIR_PROTOCOLS=>CURLPROTO_HTTPS,
    CURLOPT_SSL_VERIFYPEER=>true,
    CURLOPT_SSL_VERIFYHOST=>2,
    CURLOPT_HTTPHEADER=>[
        'Content-Type: text/plain; charset=utf-8',
        'Accept: application/json'
    ],
]);
$response=curl_exec($ch);
$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
curl_close($ch);
$ack=is_string($response)?json_decode($response,true):null;
// Google Apps Script ContentService redirects to googleusercontent.com.
// A 200 alone is NOT sufficient: doPost explicitly returns {success:true}.
if($status!==200 || !is_array($ack) || ($ack['success']??null)!==true){
    reply(502,false,'SHEETS_SAVE_NOT_CONFIRMED');
}
reply(200,true,'SHEETS_SAVED');

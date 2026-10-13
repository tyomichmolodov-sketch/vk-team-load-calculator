<?php
/**
 * Telegram Mini App lead delivery, server-side only.
 * Set ASPECKOR_BOT_TOKEN and ASPECKOR_LEADS_CHAT_ID in private server config.
 * Never publish real credentials in GitHub.
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
$chatId=(string)(getenv('ASPECKOR_LEADS_CHAT_ID') ?: '');
if(!preg_match('/^[0-9]{5,16}:[A-Za-z0-9_-]{20,}$/D',$botToken) ||
   !preg_match('/^-?[0-9]{5,20}$/D',$chatId)) {
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
$esc=static fn($s)=>htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
$lines=[
    '<b>Заявка: расчёт загрузки бригад</b>',
    'Источник: '.$esc($source),
    'Имя: '.$esc($name),
    'Телефон: +'.$esc($phone),
    'Город: '.$esc($city),
    'Бригад: '.$esc($teams===5?'5+':$teams),
    'Текущих объектов/мес.: '.$esc($current),
    'Ориентир заказов/мес.: '.$esc($target===null?'индивидуально':$target),
    'Недостаёт заказов/мес.: '.$esc($gap===null?'индивидуально':$gap),
    'Желаемый звонок: '.$esc($localTime.' ('.$tz.')'),
    'Telegram user ID: '.$esc($userId),
];
if(!function_exists('curl_init'))reply(503,false,'CURL_UNAVAILABLE');
$ch=curl_init('https://api.telegram.org/bot'.$botToken.'/sendMessage');
$body=json_encode(['chat_id'=>$chatId,'text'=>implode("\n",$lines),'parse_mode'=>'HTML','disable_web_page_preview'=>true],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
curl_setopt_array($ch,[
    CURLOPT_POST=>true,
    CURLOPT_POSTFIELDS=>$body,
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_CONNECTTIMEOUT=>8,
    CURLOPT_TIMEOUT=>18,
    CURLOPT_FOLLOWLOCATION=>false,
    CURLOPT_SSL_VERIFYPEER=>true,
    CURLOPT_SSL_VERIFYHOST=>2,
    CURLOPT_HTTPHEADER=>['Content-Type: application/json','Accept: application/json'],
]);
$resp=curl_exec($ch);
$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
curl_close($ch);
$answer=is_string($resp)?json_decode($resp,true):null;
if($code!==200 || !is_array($answer) || ($answer['ok']??null)!==true ||
   empty($answer['result']['message_id'])) {
    reply(502,false,'DELIVERY_NOT_CONFIRMED');
}
reply(200,true,'DELIVERED');
